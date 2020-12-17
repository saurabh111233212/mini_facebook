var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
var db = new AWS.DynamoDB();
var async = require('async');
var moment = require('moment');

// stores a default value for string sets (users cannot have a name this long anyway)
var defVal = "XXXXXXXXXXXXXXXXXXXXX";

// value in minutes for how long to conside a user as active from current time
var activeDiff = 15;

// gives us an easy way to remove the default value from any returned array
function removeDef(arr) {
	var i = arr.indexOf(defVal);
	// just in case defVal isn't there (only should be using on arrays where it is present)
	if (i > -1) {
		arr.splice(i, 1);
	}
	return arr;
};

// Searches to see if a user exists in the "users" table
var dbLookupUser = function(searchTerm, attribute, callback) {

	var params = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: searchTerm }]
			}
		},
		TableName: "users",
		AttributesToGet: [attribute]
	};

	db.query(params, function(err, data) {
		if (err || data.Items.length == 0) {
			callback(err, null);
		} else {
			callback(err, data.Items[0][attribute].S);
		}
	});
};

// Searches and returns everything a whole user
var dbLookupEntireUser = function(username, callback) {
	var params = {
		TableName: "users",
		KeyConditionExpression: 'username = :user',
		ExpressionAttributeValues: {
			':user': { "S": username }
		}
	};

	db.query(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			callback(null, data);
		}
	});
}
// Adds a non-existing user to the table
var dbCreateUser = function(userInfo, callback) {

	var params = {
		TableName: "users",
		Item: {
			"username": { "S": userInfo.username },
			"password": { "S": userInfo.password },
			"salt": { "S": userInfo.salt },
			"first_name": { "S": userInfo.first_name },
			"last_name": { "S": userInfo.last_name },
			"birthday": { "S": userInfo.birthday },
			"email": { "S": userInfo.email },
			"interests": { "SS": userInfo.interests },
			"affiliation": { "S": userInfo.affiliation },
			"friendRequests": { "SS": [defVal] },
			"friends": { "SS": [defVal] },
			//default value to store chats because DynamoDB set cannot be empty
			"chats": { "NS": ["-1"] }
		}
	};
	db.putItem(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(err, null);
		} else {

			// if successfully add all of their prefixes to the prefix table for use in searches
			let first = userInfo.first_name.toLowerCase();
			let last = userInfo.last_name.toLowerCase();

			let promiseArr = [];

			let fPrefix = '';
			let lPrefix = '';

			// add all first name prefixes to the table
			for (var i = 0; i < first.length; i++) {
				fPrefix += first.charAt(i);
				// generate prefix paramter based on current prefix
				let prefixParam = {
					TableName: "prefixes",
					Item: {
						"prefix": { "S": fPrefix },
						"first_name": { "S": first },
						"last_name": { "S": last },
						"username": { "S": userInfo.username },
						"affiliation": { "S": userInfo.affiliation }
					}
				}
				// add items to prefix table
				let promise = new Promise(function(resolve, reject) {
					db.putItem(prefixParam, function(err, data) {
						if (err) {
							console.log(err);
							reject();
						} else {
							resolve();
						}
					});
				});
				promiseArr.push(promise);
			}

			// add all last name prefixes to the table
			for (var i = 0; i < last.length; i++) {
				lPrefix += last.charAt(i);
				// generate prefix paramter based on current prefix
				let prefixParam = {
					TableName: "prefixes",
					Item: {
						"prefix": { "S": lPrefix },
						"first_name": { "S": first },
						"last_name": { "S": last },
						"username": { "S": userInfo.username }
					}
				}
				// add items to prefix table
				let promise = new Promise(function(resolve, reject) {
					db.putItem(prefixParam, function(err, data) {
						if (err) {
							console.log(err);
							reject();
						} else {
							resolve();
						}
					});
				});
				promiseArr.push(promise);
			}

			// when all updates have been made we are finished
			Promise.all(promiseArr).then(
				success => {
					callback(null, data);
				},
				failure => {
					callback('failed promise', null);
				}
			);
		}
	});
};

// Adds a post to the DynamoDB table
var dbCreatePost = function(postInfo, callback) {
	var params = {
		TableName: "posts",
		Item: {
			"username": { "S": postInfo.username },
			"post_id": { "N": postInfo.postId.toString() },
			"post": { "S": postInfo.post },
			"posted_to": { "S": postInfo.postedTo },
			"likes": { "N": '0' },
			"liked_by": { "SS": [defVal] }
		}
	};

	db.putItem(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			callback(err, data);
		}
	});
};

// Removes a post from DynamoDB table
var dbRemovePost = function(postInfo, callback) {
	var params = {
		TableName: "posts",
		Key: {
			'username': { "S": postInfo.username },
			'post_id': { "N": postInfo.post_id }
		}
	};

	db.deleteItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			callback(null, data);
		}
	});
};

// Adds a comment to DynamoDB table
var dbCreateComment = function(commentInfo, callback) {

	var params = {
		TableName: "comments",
		Item: {
			"post_id": { "N": commentInfo.postId.toString() },
			"comment_id": { "N": commentInfo.commentId.toString() },
			"username": { "S": commentInfo.username },
			"comment": { "S": commentInfo.comment }
		}
	};

	db.putItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			callback(err, data);
		}
	});
};

// Gets all posts from DynamoDB table from current user (this is Zach's proudest function)
var dbGetPosts = function(getPostsInfo, callback) {

	// Get an array of all of the users and if this is a profile post
	let isProfile = getPostsInfo.isProfile;
	let postedTo = getPostsInfo.postedTo;
	let users = getPostsInfo.friends;
	users.push(getPostsInfo.username);

	// For each user, we want to query their 10 most recent posts
	var promiseArr = [];
	var results = [];

	for (var i = 0; i < users.length; i++) {

		let currUser = users[i];

		// create a param for the current user
		let params = {
			TableName: "posts",
			KeyConditionExpression: 'username = :user',
			ExpressionAttributeValues: {
				':user': { "S": currUser }
			},
			ScanIndexForward: false,
			Limit: 10
		}

		// check if we are finding profile posts, then make a different param if so
		if (isProfile) {
			params = {
				TableName: "posts",
				KeyConditionExpression: 'username = :user',
				FilterExpression: "posted_to = :postedTo",
				ExpressionAttributeValues: {
					':user': { "S": currUser },
					':postedTo': { "S": postedTo }
				},
				ScanIndexForward: false,
				Limit: 10
			}
		}

		// query for each user and add this promise to promiseArr
		let promise = new Promise(function(resolve, reject) {
			db.query(params, function(err, data) {
				if (err) {
					console.log(err);
					reject();
				} else {
					results.push(data);
					resolve();
				}
			});
		});
		promiseArr.push(promise);
	}

	// when all queries have returned results, return all of the posts
	Promise.all(promiseArr).then(
		success => {
			let posts = [];

			// we iterate through each of the results (representing query for each user)
			for (var i = 0; i < results.length; i++) {
				let r = results[i].Items;
				// we now iterate through each of the user's returned queries (up to N = 10)
				for (var j = 0; j < r.length; j++) {
					let post = r[j];
					posts.push({
						username: post.username.S,
						post_id: post.post_id.N,
						post: post.post.S,
						posted_to: post.posted_to.S,
						likes: post.likes.N
					});
				}
			}

			// at this point posts contains objects of the (up to N = 10) most recent posts for
			// the current user and all of their friends. Now we sort chronologically using the post_id
			// (larger post_id means more recent post)
			posts.sort((a, b) => {
				return b.post_id - a.post_id
			});

			callback(null, posts);
		},
		fail => {
			callback('error', null);
		}
	);
};

// Gets chats from DynamoDB table from current user
// ** Need to eventually add so we can only get chats from account & friends **
var dbGetChats = function(getChatsInfo, callback) {
	var user = getChatsInfo.username;
	var chats = [];

	var params = {
		TableName: "users",
		KeyConditionExpression: 'username = :user',
		ExpressionAttributeValues: {
			':user': { 'S': user }
		}
	};

	//lookup user
	db.query(params, function(err, data) {
		if (err) {
			console.log(err);
		}
		else {
			//get the chat ids
			chats = data.Items[0].chats.NS;

			var result = [];

			//get the chats from chat ids
			async.each(chats, function(id, cb) {
				if (id != '-1') {
					var params = {
						TableName: "chats",
						KeyConditionExpression: 'chat_id = :id',
						ExpressionAttributeValues: {
							':id': { 'N': id }
						}
					};

					db.query(params, function(err, data) {
						if (err) {
							console.log(err);
							cb();
						} else {
							if (data.Items.length == 1) {
								result.push(data.Items[0]);
							}
							cb();
						}
					});
				}
				else {
					cb();
				}
			}, function(err) {
				if (err) {
					callback(err, null);
				}
				else {
					callback(err, result);
				}
			});
		}
	});


};

// Update chat with new chat message history
var dbUpdateChat = function(chat_id, members, chat_name, new_msg, callback) {
	var stdTime = new_msg.time;
	new_msg.time = moment(new_msg.time).format('MMM Do YYYY, h:mm a');
	console.log(stdTime);
	console.log(new_msg.time);
	var params = {
		TableName: "chats",
		KeyConditionExpression: 'chat_id = :id',
		ExpressionAttributeValues: {
			':id': { "N": chat_id }
		}
	};


	// Look up chats with chat id
	db.query(params, function(err, data) {
		if (err || data.Count >= 2) {
			console.log(err);
			callback(err, null);
		}
		else if (data.Count == 0) {
			// No chat found with current id, create new chat
			var params = {
				TableName: "chats",
				Item: {
					"chat_id": { "N": chat_id },
					"last_message": { "S": JSON.stringify(new_msg) },
					"last_message_time": { "S": stdTime },
					"members": { "SS": members },
					"message_history": { "S": JSON.stringify([new_msg]) },
					"chat_name": { "S": "" }
				}
			};

			// Add chat to chats table
			db.putItem(params, function(err, data) {
				if (err) {
					callback(err, null);
				} else {
					// add chat in each member's entry in user table
					async.each(members, function(member, cb) {

						var params = {
							TableName: "users",
							Key: { "username": { S: member } },
							ExpressionAttributeValues: {
								":new_chat": { NS: [chat_id] }
							},
							UpdateExpression: "ADD chats :new_chat"
						};

						db.updateItem(params, function(err, data) {
							if (err) {
								console.log("Error updating chats in user table: " + err);
								cb();
							} else {
								cb();
							}
						});
					}, function(err) {
						if (err) {
							callback(err, null);
						}
						else {
							callback(err, data);
						}
					});
				}
			});
		}
		else {
			// chat found with current id
			console.log(data.Items[0]);
			var message_history_list = JSON.parse(data.Items[0].message_history.S);
			message_history_list.push(new_msg);

			var new_msg_history_JSON = JSON.stringify(message_history_list);
			var new_msg_JSON = JSON.stringify(new_msg);

			var params = {
				TableName: "chats",
				Key: { "chat_id": { N: chat_id } },
				ExpressionAttributeValues: {
					":chat": { S: new_msg_history_JSON },
					":last_msg": { S: new_msg_JSON },
					":last_msg_time": { S: stdTime }
				},
				UpdateExpression: "set message_history = :chat, last_message = :last_msg, last_message_time = :last_msg_time"
			};

			db.updateItem(params, function(err, data) {
				if (err) {
					console.log("Error updating message history: " + err);
					callback(err, null);
				} else {
					callback(err, data);
				}
			});
		}
	});

}

// Update chat with new chat name
var dbUpdateChatName = function(chat_id, chat_name, callback) {
	var params = {
		TableName: "chats",
		Key: { "chat_id": { N: chat_id } },
		ExpressionAttributeValues: {
			":name": { S: chat_name },
		},
		UpdateExpression: "set chat_name = :name"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error updating chat name: " + err);
			callback(err, null);
		} else {
			callback(err, data);
		}
	});
}

// Update chat with new members
var dbAddMembers = function(chat_id, people_to_add, callback) {
	var params = {
		TableName: "chats",
		Key: { "chat_id": { N: chat_id } },
		ExpressionAttributeValues: {
			":people": { SS: people_to_add },
		},
		UpdateExpression: "ADD members :people"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error adding members: " + err);
			callback(err, null);
		} else {
			// add chat in each member's entry in user table
			async.each(people_to_add, function(person, cb) {

				var params = {
					TableName: "users",
					Key: { "username": { S: person } },
					ExpressionAttributeValues: {
						":new_chat": { NS: [chat_id] }
					},
					UpdateExpression: "ADD chats :new_chat"
				};

				db.updateItem(params, function(err, data) {
					if (err) {
						console.log("Error updating chats in user table: " + err);
						cb();
					} else {
						cb();
					}
				});
			}, function(err) {
				if (err) {
					callback(err, null);
				}
				else {
					callback(err, data);
				}
			});
		}
	});
}

// Remove chat from user
var dbRemoveChat = function(chat_id, user, callback) {
	var params = {
		TableName: "chats",
		Key: { "chat_id": { N: chat_id } },
		ExpressionAttributeValues: {
			":people": { SS: [user] },
		},
		UpdateExpression: "DELETE members :people"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error adding members: " + err);
			callback(err, null);
		} else {
			console.log(data);
			var params = {
				TableName: "users",
				Key: { "username": { S: user } },
				ExpressionAttributeValues: {
					":new_chat": { NS: [chat_id] }
				},
				UpdateExpression: "DELETE chats :new_chat"
			};

			db.updateItem(params, function(err, data) {
				if (err) {
					console.log("Error updating chats in user table: " + err);
					callback(err, null);
				} else {
					callback(err, data);
				}
			});
		}
	});
}

// Update last_active timestamp for user
var dbUpdateLastActive = function(username, timestamp, callback) {
	var params = {
		TableName: "users",
		Key: { "username": { "S": username } },
		ExpressionAttributeValues: { ":last_active": { S: timestamp } },
		UpdateExpression: "set last_active = :last_active"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error updating last_active: " + err);
			callback(err);
		} else {
			callback(null);
		}
	});
}

// Gets all comments from a particular post
var dbGetComments = function(getCommentsInfo, callback) {

	var params = {
		TableName: "comments",
		KeyConditionExpression: 'post_id = :post_id',
		ExpressionAttributeValues: {
			':post_id': { "N": getCommentsInfo.post_id }
		}
	};

	db.query(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(null);
		} else {
			callback(data);
		}
	});
};

// Increments like button on a post in DynamoDB table 
var dbLikePost = function(postInfo, callback) {

	var params = {
		TableName: "posts",
		KeyConditionExpression: 'username = :user and post_id = :postId',
		ExpressionAttributeValues: {
			':user': { "S": postInfo.poster },
			':postId': { "N": postInfo.postId }
		}
	}

	// First, we query to see if the user has already liked this post
	db.query(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(false);
		} else {
			let likedBy = data.Items[0].liked_by.SS;

			// check if the user has already liked the post
			if (likedBy.includes(postInfo.username)) {
				return callback(false);
			}

			// if they haven't already liked it, we can now update and like the post
			var params2 = {
				TableName: "posts",
				Key: { "username": { "S": postInfo.poster }, "post_id": { "N": postInfo.postId } },
				ExpressionAttributeValues: { ":inc": { "N": "1" }, ":user": { "SS": [postInfo.username] } },
				UpdateExpression: "ADD likes :inc, liked_by :user"
			};

			db.updateItem(params2, function(err, data) {
				if (err) {
					console.log(err);
					callback(false);
				} else {
					callback(true);
				}
			});
		}
	});
};

// gets all friends of a user from the dynamodb table
var dbGetFriends = function(userInfo, callback) {
	var params = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: userInfo.username }]
			}
		},
		TableName: "users",
		AttributesToGet: ["friends"]
	};

	var params2 = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: userInfo.username }]
			}
		},
		TableName: "users",
		AttributesToGet: ["friendRequests"]
	};

	var data = {
		friends: [],
		requests: []
	}

	db.query(params, function(err, d1) {
		if (err || !d1) {
			console.log(err, null);
		} else {
			data.friends = removeDef(d1.Items[0].friends.SS);
			db.query(params2, function(err, d2) {
				if (err || !d2) {
					console.log(err, null);
				} else {
					data.requests = removeDef(d2.Items[0].friendRequests.SS);
					callback(null, data);
				}
			})
		}
	});
};

// gets all online friends of a user from the dynamodb table
var dbGetOnlineFriends = function(userInfo, callback) {
	var params = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: userInfo.username }]
			}
		},
		TableName: "users",
		AttributesToGet: ["friends"]
	};

	db.query(params, function(err, d1) {
		if (err || !d1) {
			console.log(err, null);
		} else {
			var friends = removeDef(d1.Items[0].friends.SS);

			var result = [];

			//get the friends from user table
			async.each(friends, function(username, cb) {
				var params = {
					TableName: "users",
					KeyConditions: {
						username: {
							ComparisonOperator: 'EQ',
							AttributeValueList: [{ S: username }]
						}
					},
					AttributesToGet: ["username", "last_active"]
				};

				db.query(params, function(err, data) {
					if (err) {
						console.log(err);
						cb();
					} else {
						if (data.Items.length == 1) {
							var lastActive = data.Items[0].last_active.S;
							if (lastActive && moment().diff(lastActive, 'minutes') <= activeDiff) {
								result.push(data.Items[0].username.S);
							}
						}
						cb();
					}
				});
			}, function(err) {
				if (err) {
					callback(err, null);
				}
				else {
					callback(err, result);
				}
			});
		}
	});
};

// sends a friend request to user in dynamodb table
var dbAddFriend = function(addFriendInfo, callback) {

	// first we check to see if they are already friends
	var paramsCheck = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: addFriendInfo.username }]
			}
		},
		TableName: "users",
		AttributesToGet: ["friends"]
	};

	db.query(paramsCheck, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			var currFriends = data.Items[0].friends.SS;
			// if the user you are trying to add is already your friend, return an error
			if (currFriends.includes(addFriendInfo.friendUsername)) {
				let err = addFriendInfo.friendUsername + ' is already your friend!';
				callback(err, null);
			} else {
				// else add them as a friend if they are not already
				var params = {
					TableName: "users",
					Key: { "username": { "S": addFriendInfo.friendUsername } },
					UpdateExpression: "ADD friendRequests :newFriend",
					ExpressionAttributeValues: {
						':newFriend': { "SS": [addFriendInfo.username] }
					}
				}

				db.updateItem(params, function(err, data) {
					if (err) {
						console.log(err);
					} else {
						callback(null, data);
					}
				});
			}
		}
	});
};

// removes a friend from dynamodb table
var dbRemoveFriend = function(requestInfo, callback) {
	let user = requestInfo.user;
	let friend = requestInfo.friend;

	// Delete friend's from each others tables
	var params = {
		TableName: "users",
		Key: { "username": { "S": user } },
		UpdateExpression: "DELETE friends :friend",
		ExpressionAttributeValues: {
			":friend": { "SS": [friend] }
		}
	}

	var params2 = {
		TableName: "users",
		Key: { "username": { "S": friend } },
		UpdateExpression: "DELETE friends :friend",
		ExpressionAttributeValues: {
			":friend": { "SS": [user] }
		}
	}

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log(err);
			callback(err, null);
		} else {
			db.updateItem(params2, function(err, data) {
				if (err) {
					console.log(err);
					callback(err, null);
				} else {
					callback(null, data);
				}
			});
		}
	});
};

// accepts a friend request and adds user to friend table
var dbAcceptFriendRequest = function(requestInfo, callback) {
	// Two parameters to accept the friend request for both users
	var params = {
		TableName: "users",
		Key: { "username": { "S": requestInfo.username } },
		UpdateExpression: "DELETE friendRequests :friend ADD friends :newFriend",
		ExpressionAttributeValues: {
			":friend": { "SS": [requestInfo.friendUsername] },
			":newFriend": { "SS": [requestInfo.friendUsername] }
		}
	}

	var params2 = {
		TableName: "users",
		Key: { "username": { "S": requestInfo.friendUsername } },
		UpdateExpression: "ADD friends :newFriend",
		ExpressionAttributeValues: {
			":newFriend": { "SS": [requestInfo.username] }
		}
	}

	db.updateItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			db.updateItem(params2, function(err2, data2) {
				if (err2) {
					callback(err, null);
				} else {
					callback(null, data2);
				}
			});
		}
	});
};

// rejects a friend request 
var dbRejectFriendRequest = function(requestInfo, callback) {
	var params = {
		TableName: "users",
		Key: { "username": { "S": requestInfo.username } },
		UpdateExpression: "DELETE friendRequests :friend",
		ExpressionAttributeValues: {
			":friend": { "SS": [requestInfo.friendUsername] }
		}
	}

	db.updateItem(params, function(err, data) {
		if (err) {
			callback(err, null);
		} else {
			callback(null, data);
		}
	});
};

//updates a profile given arguements to update
var dbUpdateInterests = function(username, newInterests, callback) {
	var params = {
		KeyConditions: {
			username: {
				ComparisonOperator: 'EQ',
				AttributeValueList: [{ S: username }]
			}
		},
		TableName: "users",
		AttributesToGet: ["interests"]
	};

	var interests = [];

	db.query(params, function(err, data) {
		if (err || !data) {
			console.log("Error: " + err);
		} else {
			interests = data.Items[0]['interests'].SS;
			for (var i = 0; i < newInterests.length; i++) {
				interests.push(newInterests[i]);
			}
			var params = {
				TableName: "users",
				Key: { "username": { "S": username } },
				ExpressionAttributeValues: { ":int": { SS: interests } },
				UpdateExpression: "set interests = :int"
			};

			db.updateItem(params, function(err, data) {
				if (err) {
					console.log("Error: " + err);
					callback(err, null, null);
				} else {
					callback(null, newInterests, username);
				}
			});
		}
	});
}

var dbUpdatePassword = function(username, passInfo, callback) {

	var params = {
		TableName: "users",
		Key: { "username": { "S": username } },
		ExpressionAttributeValues: { ":pass": { S: passInfo.password }, ":salt": { "S": passInfo.salt } },
		UpdateExpression: "SET password = :pass, salt = :salt"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error updating password: " + err);
		} else {
			callback(null);
		}
	});

}

var dbUpdateEmail = function(username, newEmail, callback) {
	var params = {
		TableName: "users",
		Key: { "username": { "S": username } },
		ExpressionAttributeValues: { ":email": { S: newEmail } },
		UpdateExpression: "set email = :email"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error updating email: " + err);
		} else {
			callback(null);
		}
	});
}

var dbUpdateAff = function(username, newAff, callback) {
	var params = {
		TableName: "users",
		Key: { "username": { "S": username } },
		ExpressionAttributeValues: { ":aff": { S: newAff } },
		UpdateExpression: "set affiliation = :aff"
	};

	db.updateItem(params, function(err, data) {
		if (err) {
			console.log("Error updating affiliation: " + err);
			callback(err, null, null);
		} else {
			callback(null, newAff, username);
		}
	});
}

/** Gets all affiliations (scan, costly operation)
 */
var dbGetAffiliations = async function(callback) {
	var params = {
		TableName: "users"
	};
	var affiliations = [];
	var items;

	do {
		// Scan the table for each item and wait until promise is resolved
		items = await db.scan(params).promise();
		// Add the item to our results
		items.Items.forEach((item) => affiliations.push({
			user: item.username.S,
			affiliation: item.affiliation.S
		}));
		// Start our search on the next item (this took forever to find out :( )
		params.ExclusiveStartKey = items.LastEvaluatedKey;
		// Continue until we have went through all of the items
	} while (typeof items.LastEvaluatedKey != "undefined");

	callback(null, affiliations);
}

/** Gets news suggestions from db
 */
var dbGetNewsSuggestions = function(searchInput, callback) {

	// split on spaces to extract all of the typed words
	let lcInput = searchInput.toLowerCase();
	let words = lcInput.split(" ");

	let promiseArr = [];

	// for each word that the user has typed
	for (var i = 0; i < words.length; i++) {
		let word = words[i];
		if (word === '') {
			continue;
		} else {
			// create a parameter that filters to find keywords that begin with the typed field
			let params = {
				TableName: "keywords",
				FilterExpression: "begins_with(keyword, :input)",
				ExpressionAttributeValues: {
					':input': { "S": word }
				}
			}

			var results = [];
			var count = 0;

			// scan the db and collect results (apparently you can't freaking query using begins_with if you are reading this
			// meaning I have to do a scan I know its costly but pls forgive me :())
			let promise = new Promise(function(resolve, reject) {
				db.scan(params, function(err, data) {
					if (err) {
						console.log(err);
						reject();
					} else {
						data.Items.forEach(function(elmt, ind, arr) {
							if (count < 10) {
								results.push(elmt);
								count++
							}
						});
						resolve();
					}
				});
			});
			promiseArr.push(promise);
		}
	}

	Promise.all(promiseArr).then(
		success => {
			var newsSuggestions = [];
			// return the news in a (nicer) format
			for (var i = 0; i < results.length; i++) {
				let r = results[i];
				newsSuggestions.push({
					name: r.headline.S,
					link: r.link.S,
					keyword: r.keyword.S
				});
			}
			callback(null, newsSuggestions);
		},
		fail => {
			console.log('fail');
			callback('failed', null);
		}
	);
}
/** Gets search suggestions from db. Used a prefix table to enhance scalability (don't have to use
    a scan operation!)
 */
var dbGetSuggestions = async function(searchInput, user, callback) {
	let lcInput = searchInput.toLowerCase();
	let keywords = lcInput.split(" ");

	let promiseArr = [];
	let results = [];

	// for each keyword, make a parameter and query prefix table
	for (var i = 0; i < keywords.length; i++) {
		let keyword = keywords[i];
		if (keyword === '') {
			continue;
		}
		let params = {
			TableName: "prefixes",
			KeyConditionExpression: 'prefix = :prefix',
			ExpressionAttributeValues: {
				':prefix': { "S": keyword }
			}
		}

		let promise = new Promise(function(resolve, reject) {
			db.query(params, function(err, data) {
				if (err) {
					console.log(err);
					reject();
				} else {
					for (var i = 0; i < data.Items.length; i++) {
						results.push(data.Items[i]);
					}
					resolve();
				}
			});
		});
		promiseArr.push(promise);
	}

	Promise.all(promiseArr).then(
		success => {
			callback(null, results);
		},
		failure => {
			console.log('fail');
			callback('failure', null);
		}
	);
}

var database = {
	defVal: defVal,
	lookupUser: dbLookupUser,
	lookupUserAll: dbLookupEntireUser,
	addUser: dbCreateUser,
	createPost: dbCreatePost,
	removePost: dbRemovePost,
	getPosts: dbGetPosts,
	getChats: dbGetChats,
	updateChat: dbUpdateChat,
	updateChatName: dbUpdateChatName,
	addMembers: dbAddMembers,
	removeChat: dbRemoveChat,
	updateLastActive: dbUpdateLastActive,
	getComments: dbGetComments,
	createComment: dbCreateComment,
	updateInterests: dbUpdateInterests,
	updatePassword: dbUpdatePassword,
	updateEmail: dbUpdateEmail,
	updateAff: dbUpdateAff,
	likePost: dbLikePost,
	getFriends: dbGetFriends,
	getOnlineFriends: dbGetOnlineFriends,
	addFriend: dbAddFriend,
	removeFriend: dbRemoveFriend,
	acceptFriend: dbAcceptFriendRequest,
	rejectFriend: dbRejectFriendRequest,
	getAffiliations: dbGetAffiliations,
	getSuggestions: dbGetSuggestions,
	getNewsSuggestions: dbGetNewsSuggestions
};

module.exports = database;
