var db = require('../models/database.js');
var hasher = require('../models/hashing.js');
// for getting current time
var moment = require("moment");

/** Gets the signup page for our website. This is the first website you see when entering our domain.
    If there is an error it will send it to be rendered.
 */
var getLogin = function(req, res) {
	if (req.session.error != null) {
		var err = req.session.error;
		req.session.error = null;
		res.render('main.ejs', { message: err });
	} else {
		res.render('main.ejs', { message: null });
	}
};

/** Displays page for account creation.
 */
var getSignup = function(req, res) {
	if (req.session.error != null) {
		var err = req.session.error;
		req.session.error = null;
		res.render('signup.ejs', { message: err });
	} else {
		res.render('signup.ejs', { message: null });
	}
};

/** Gets the main home page for our website. This will be the page that appears once the user logs in
	successfully.
 */
var getHome = function(req, res) {
	if (typeof req.session.username === 'undefined') {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});
	
	res.render('home.ejs', { user: req.session.username, firstName: req.session.first_name, lastName: req.session.last_name, interests: req.session.interests });
};

/** Gets the news feed page
 */
var getNewsFeed = function(req, res) {
	if (typeof req.session.username === 'undefined') {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});
	
	res.render('newsfeed.ejs', { user: req.session.username, firstName: req.session.first_name, lastName: req.session.last_name, interests: req.session.interests });
}

/** When the user logs out, send them back home
 */
var getLogout = function(req, res) {
	delete req.session.username;
	delete req.session.last_name;
	delete req.session.first_name;
	delete req.session.interests;
	delete req.session.last_active;
	req.session.error = "oh wait you meant to do that";
	res.redirect('/');
};

/** Gets the profile page for the user.
 */
var getProfile = function(req, res) {
	var user = req.session.username;
	if (!user) {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});
	
	db.lookupUser(user, 'affiliation', function(err, aff) {
		if (err) {
			res.redirect('/home');
		} else {
			res.render('profile.ejs', { user: user, aff: aff, firstName: req.session.first_name, lastName: req.session.last_name, interests: req.session.interests });
		}
	});
}

var getProfileEdit = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});
	
	res.render('profileEdit.ejs', { user: req.session.username });
}

/** Gets the friend page for the user and additionally sends friend information from database.
 */
var getFriendsPage = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});
	
	res.render('friends.ejs', { user: req.session.username, friends: null, requests: null, firstName: req.session.first_name, lastName: req.session.last_name, interests: req.session.interests });
}

/** Gets all affiliations for every user in the database.
 */
var getAllAffiliations = function(req, res) {
	db.getAffiliations(function(err, data) {
		if (err) {
			console.log(err);
		} else {
			res.send(data);
		}
	})
};

/** Gets friend data regardless of who is online
 */
var getFriendsData = function(req, res) {

	// search up friends in dynamodb table to return
	var userInfo = {
		username: req.session.username
	}

	// if we are searching for another users data
	if (req.body.searchedUser) {
		userInfo.username = req.body.searchedUser
	}

	var friends = [];
	var requests = [];

	// get information about friends & requests from database
	db.getFriends(userInfo, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			// get user's friends, requests, and affiliation
			friends = data.friends;
			requests = data.requests;

			res.send({ user: userInfo.username, friends: friends, requests: requests });
		}
	});
}

/** Gets friend data for who is online
 */
var getOnlineFriendsData = function(req, res) {
	// search up friends in dynamodb table to return
	var userInfo = {
		username: req.session.username
	}

	// if we are searching for another users data
	if (req.body.searchedUser) {
		userInfo.username = req.body.searchedUser
	}

	var friends = [];

	// get information about friends & requests from database
	db.getOnlineFriends(userInfo, function(err, data) {
		if (err) {
			console.log(err);
		} else {
			// get user's friends, requests, and affiliation
			friends = data;

			res.send({ user: userInfo.username, friends: friends});
		}
	});
}

/** Adds a friend to the dynamodb table
 */
var addFriend = function(req, res) {

	var addFriendInfo = {
		username: req.session.username,
		friendUsername: req.body.addFriendUser
	};

	if (addFriendInfo.username === addFriendInfo.friendUsername) {
		return res.redirect('/profile');
	}

	db.addFriend(addFriendInfo, function(err, data) {
		if (err) {
			res.send({ success: false });
		} else {
			res.send({ success: true });
		}
	});
};

/** Removes a friend from dynamodb table
 */ 
var removeFriend = function(req, res) {
	var requestInfo = {
		user: req.session.username,
		friend: req.body.friend
	};
	
	db.removeFriend(requestInfo, function(err, data) {
		if (err) {
			res.send({ success: false});
		} else {
			res.send({ success: true});
		}
	});	
};

/** Handles friend requests
 */
var handleFriendRequest = function(req, res) {

	var success = req.body.success === 'true';

	var requestInfo = {
		username: req.session.username,
		friendUsername: req.body.friendName
	}

	if (success) {
		db.acceptFriend(requestInfo, function(err, data) {
			if (err) {
				console.log(err);
				res.send({ success: false });
			} else {
				console.log(data);
				res.send({ success: true });
			}
		});
	} else {
		db.rejectFriend(requestInfo, function(err, data) {
			if (err) {
				console.log(err);
				res.send({ success: false });
			} else {
				console.log(data);
				res.send({ success: true });
			}
		});
	}
}
var postEditInterests = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	var interests = null;
	if (req.body.interests && req.body.interests.length > 0) {
		interests = req.body.interests.split(',');
		for (var i = 0; i < interests.length; i++) {
			interests[i] = interests[i].trim();
		}
	}
	if (!interests) {
		return res.redirect('/profile');
	}
	db.updateInterests(req.session.username, interests, function(err, newInts, user) {
		if (err) {
			console.log('Error: updating interests' + err);
			req.session.error = "an unknown error has occurred. please try again";
			return res.redirect('/profile');
		} else {
			var interests = '';
			for (var i = 0; i < newInts.length; i++) {
				interests = interests + (newInts[i] + ', ');
			}
			interests = interests.substring(0, interests.length - 2);

			var postInfo = {
				post: 'is now interested in: ' + interests,
				username: user,
				postId: new Date().getTime(),
				postedTo: req.session.username
			};

			db.createPost(postInfo, function(err, data) {
				if (data) {
					console.log(interests)
					req.session.interests = req.session.interests + "," + interests;
					console.log(req.session.interests);
					res.redirect('/profile')
				} else {
					console.log(err);
				}
			});
		}
	});
};

/** Retrieves news suggestions while the user is typing from database
 */
var postNewsSuggestions = function(req, res) {
	var searchInput = req.body.input;
	
	db.getNewsSuggestions(searchInput, function(err, data) {
		if (err) {
			console.log(err);
			res.send({ success: false, suggestions: null, user: req.session.username });
		} else {
			res.send({ success: true, suggestions: data, user: req.session.username });
		}
	});
}
/** Retrieves post suggestions while the user is typing from database.
*/
var postSearchSuggestions = function(req, res) {
	var searchInput = req.body.input;
	var user = req.session.username;
	db.getSuggestions(searchInput, user, function(err, data) {
		if (err) {
			console.log(err);
			res.send({ success: false, suggestions: null, user: req.session.username });
		} else {
			res.send({ success: true, suggestions: data, user: req.session.username });
		}
	});
};

var postEditAff = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	var affiliation = null;
	if (req.body.affiliation && req.body.affiliation.length > 0) {
		affiliation = req.body.affiliation;
	}
	if (!affiliation) {
		return res.redirect('/profile');
	}

	db.updateAff(req.session.username, affiliation, function(err, aff, user) {
		if (err) {
			console.log('Error: updating affiliation' + err);
			req.session.error = "an unknown error has occurred. please try again";
			return res.redirect('/profile');
		} else {

			var postInfo = {
				post: 'is now affiliated with: ' + aff,
				username: user,
				postId: new Date().getTime()
			};

			db.createPost(postInfo, function(err, data) {
				if (data) {
					req.session.error = 'affiliation sucessfully changed!';
					res.redirect('/profile');
				} else {
					res.redirect('/profile');
				}
			});
		}
	});
};

var postEditPassword = function(req, res) {
	if (!req.session.username || req.body.password === '') {
		return res.redirect('/');
	}
	var passwordInfo = {
		password: '',
		salt: ''
	}
	if (req.body.password) {
		let p = hashPass(req.body.password);
		passwordInfo.password = p.pass;
		passwordInfo.salt = p.salt;
	}

	db.updatePassword(req.session.username, passwordInfo, function(err) {
		if (err) {
			console.log('Error updating password: ' + err);
			req.session.error = "an unknown error has occurred. please try again";
			return res.redirect('/profile');
		} else {
			req.session.error = 'Password successfully changed!';
			return res.redirect('/profile');
		}
	});
};

// get interests lazy way without getting any other data returned
var getInterests = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	
	res.send(req.session.interests);
}

var postEditEmail = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	var email = null;
	if (req.body.email && req.body.email.length > 0) {
		email = req.body.email;
	}
	if (!email) {
		return res.redirect('/profile');;
	}

	db.updateEmail(req.session.username, email, function(err) {
		if (err) {
			console.log('Error updating email: ' + err);
			req.session.error = "an unknown error has occurred. please try again";
			return res.redirect('/profile');
		} else {
			req.session.error = 'Email successfully changed!';
			return res.redirect('/profile');
		}
	});
};

/** Gets the messages page for the user
 */
var getMessages = function(req, res) {
	if (!req.session.username) {
		return res.redirect('/');
	}
	
	// set last_active to current time
	req.session.last_active = moment().format();
	db.updateLastActive(req.session.username, req.session.last_active, function(err) {
		if (err) {
			console.log('Error updating last_active: ' + err);
		} 
	});

	var chatsInfo = {
		username: req.session.username
	}

	db.getChats(chatsInfo, function(err, data) {
		if (err) {
			console.log(err);
			res.render('messages.ejs', { user: req.session.username, chats: null });
		} else {
			data.sort((a, b) => (a.last_message_time.S < b.last_message_time.S) ? 1 : -1);
			res.render('messages.ejs', { user: req.session.username, chats: data });
		}
	});
	
	/*var chats = [
		{ chat_id: 1, members: ["bubba"], last_message: { username: "bubba", message: "Hey, what's up!", time: "07:45 pm"  } },
		{ chat_id: 2, members: ["carol"], last_message: { username: "carol", message: "join the call", time: "07:35 pm" } },
		{ chat_id: 3, members: ["dominic", "john"], last_message: { username: "john", message: "yeah, i'm down", time: "03:15 pm" } },
		{ chat_id: 4, members: ["tom", "carol", "ruth"], last_message: { username: "tom", message: "lollll", time: "02:10 pm" } },
		{ chat_id: 5, members: ["kelly"], last_message: { username: "you", message: "Do you know why my div is being like this? The text isn't showing up.", time: "01:10 am" } },
	]*/
	
};

/** Adds message to chats table
 */
var postMessage = function(req, res) {
	var chatID = req.body.selectedChatID;
	var members = JSON.parse(req.body.selectedChatMembers);
	var chatName = req.body.selectedChatName;
	var newMsg = {
		username: req.session.username,
		text: req.body.msgInput,
		time: req.body.timeOfMessage
	};

	db.updateChat(chatID, members, chatName, newMsg, function(err, data) {
		if (data) {
			res.send({ success: true, data: null });
		} else {
			res.send({ success: false, data: null });
		}
	});
};

/** Edit chat name in chats table
 */
var postEditChatName = function(req, res) {
	var chatID = req.body.chat_id;
	var chatName = req.body.chat_name;

	db.updateChatName(chatID, chatName, function(err, data) {
		if (data) {
			res.send({ success: true, data: null });
		} else {
			res.send({ success: false, data: null });
		}
	});
};

/** Add new members to chat in chats table and make it a group chat
 */
var postAddMembers = function(req, res) {
	var chatID = req.body.chat_id;
	var peopleToAdd = req.body.people_to_add;

	db.addMembers(chatID, peopleToAdd, function(err, data) {
		if (data) {
			res.send({ success: true, data: null });
		} else {
			res.send({ success: false, data: null });
		}
	});
};

/** Remove chat from user
 */
var postRemoveChat = function(req, res) {
	var chatID = req.body.chat_id;
	var user = req.session.username;

	db.removeChat(chatID, user, function(err, data) {
		if (data) {
			res.send({ success: true, data: null });
		} else {
			res.send({ success: false, data: null });
		}
	});
};


var hashPass = function(pass) {
	let salt = hasher.makeSalt(32);
	let hashedPass = hasher.hash(pass, salt).hashedInput;
	return {pass: hashedPass, salt: salt};
}

/** Creates a new account when the user clicks "Create account" button on signup.ejs
 */
var createAccount = function(req, res) {
	// Generate a hashed password to enter in database
	let salt = hasher.makeSalt(32);
	let hashedPass = hasher.hash(req.body.myPassInput, salt).hashedInput;
	var interests = req.body.interests.split(',');
	for (var i = 0; i < interests.length; i++) {
		interests[i] = interests[i].trim();
	}
	var userInfo = {
		username: req.body.myUserInput,
		password: hashedPass,
		first_name: req.body.myFirstName.toLowerCase(),
		last_name: req.body.myLastName.toLowerCase(),
		birthday: req.body.myBirthday,
		email: req.body.myEmail,
		salt: salt,
		affiliation: req.body.affiliation,
		interests: interests
	};

	// Validate that all inputs are filled in
	for (const prop in userInfo) {
		if (userInfo[prop] == "") {
			req.session.error = "please fill in all input fields";
			return res.redirect('/signup');
		}
		if (prop == 'interests' && userInfo[prop].length < 2) {
			req.session.error = "please enter at least 2 interests";
			return res.redirect('/signup');
		}
	};

	db.lookupUser(userInfo.username, 'password', function(err, data) {
		if (data === null) {
			db.addUser(userInfo, function(err, data) {
				if (data) {
					req.session.username = userInfo.username;
					req.session.first_name = userInfo.first_name;
					req.session.last_name = userInfo.last_name;
					req.session.interests = userInfo.interests;
					res.redirect('/home');
				} else {
					req.session.error = "an unknown error has occurred. please try to create your account again";
					res.redirect('/signup');
				}
			});
		} else {
			req.session.error = "username is taken, please try again";
			res.redirect('/signup');
		}
	});
};

/** Checks whether a user's login information is correct and will log them into the main page if so.
 */
var checkLogin = function(req, res) {
	var userInfo = {
		username: req.body.myUserInput,
		password: req.body.myPassInput
	};

	// Validate all input fields are filled in
	for (const prop in userInfo) {
		if (userInfo[prop] == "") {
			req.session.error = "please fill in all input fields";
			return res.redirect('/');
		}
	};

	/** Find the user's salt and use it to hash the inputted password. If this hashed password
	    is the same as what is in the database, their password is authenticated and they can
		log in (provided their username is also correct).
	 */
	db.lookupUserAll(userInfo.username, function(err, data) {
		if (data.Items.length != 0 && data != null) {
			let user = data.Items[0];
			let hashedPass = hasher.hash(userInfo.password, user.salt.S).hashedInput;
			// authenticate user by checking if it is the same
			db.lookupUser(userInfo.username, 'password', function(err, data) {
				if (data == hashedPass) {
					req.session.username = userInfo.username;
					req.session.first_name = user.first_name.S;
					req.session.last_name = user.last_name.S;
					req.session.interests = user.interests.SS;
					req.session.last_active = moment().format();
					res.redirect('/home');
				} else if (err) {
					console.log(err);
					req.session.error = "an unknown error has occurred. please try again";
					res.redirect('/');
				} else {
					req.session.error = "username or password is incorrect";
					res.redirect('/');
				}
			});
		} else {
			req.session.error = "username or password is incorrect";
			res.redirect('/');
		}
	});
};

/** Gets all of the posts for the profile page. This includes all of your own posts in chronological order.
 */
var getProfilePosts = function(req, res) {
	var userInfo = {
		username: req.session.username,
		friends: [],
		isProfile: true,
		postedTo: req.session.username
	}

	if (req.body.searchedUser) {
		userInfo.username = req.body.searchedUser;
		userInfo.postedTo = req.body.searchedUser;
	}

	// get a user's friends to use in the database call
	db.getFriends(userInfo, function(friendErr, data) {
		if (friendErr) {
			console.log("Error retrieving friends");
		} else {
			userInfo.friends = data.friends;
			// get all posts from the database in chronological order from these users
			db.getPosts(userInfo, function(postErr, postData) {
				if (postErr) {
					console.log("Error retrieving posts");
				} else {
					// we now have to return all of the comments of those posts
					var promiseArr = [];
					var comments = new Map();

					for (var i = 0; i < postData.length; i++) {
						let currId = postData[i].post_id;
						let getCommentsInfo = { post_id: currId };
						let promise = new Promise(function(resolve, reject) {
							db.getComments(getCommentsInfo, function(commentData) {
								comments.set(currId, commentData.Items);
								resolve();
							});
						});
						promiseArr.push(promise);
					}

					Promise.all(promiseArr).then(
						success => {
							res.send({ userPosts: postData, postComments: [...comments], user: req.session.username });
						},
						fail => {
							console.log('error occurred');
						}
					);
				}
			});
		}
	});
}

/** Gets all of the posts for the current user to be displayed when the home page is navigated to.
    Should later add friends posts to be added as well.
 */
var getHomePosts = function(req, res) {

	var userInfo = {
		username: req.session.username,
		friends: [],
		isProfile: false,
		postedTo: ''
	};

	// get a user's friends to use in the database call
	db.getFriends(userInfo, function(friendErr, data) {
		if (friendErr) {
			console.log("Error retrieving friends");
		} else {
			userInfo.friends = data.friends;
			// get all posts from the database in chronological order from these users
			db.getPosts(userInfo, function(postErr, postData) {
				if (postErr) {
					console.log("Error retrieving posts");
				} else {
					// we now have to return all of the comments of those posts
					var promiseArr = [];
					var comments = new Map();

					for (var i = 0; i < postData.length; i++) {
						let currId = postData[i].post_id;
						let getCommentsInfo = { post_id: currId };
						let promise = new Promise(function(resolve, reject) {
							db.getComments(getCommentsInfo, function(commentData) {
								comments.set(currId, commentData.Items);
								resolve();
							});
						});
						promiseArr.push(promise);
					}

					Promise.all(promiseArr).then(
						success => {
							res.send({ userPosts: postData, postComments: [...comments], user: req.session.username });
						},
						fail => {
							console.log('error occurred');
						}
					);
				}
			});
		}
	});
}

/** Creates a post when the user clicks the "post" button. 
 */
var createPost = function(req, res) {
	var postInfo = {
		post: req.body.post,
		username: req.session.username,
		postId: new Date().getTime(),
		postedTo: req.body.postedTo
	};

	// Check if you are either posting to yourself or a friend, if not don't post!
	var friends = [];

	db.getFriends(postInfo, function(err, data) {
		if (err) {
			res.send({ success: false, data: null, user: req.session.username });
		} else {
			friends = data.friends;
			// Cannot post to a wall that is not your own or a friends!
			if (postInfo.username != postInfo.postedTo && !friends.includes(postInfo.postedTo)) {
				res.send({success: false, data: null, user: req.session.username});
			} else {
				// If you are posting to your own wall or a friend, just create the post as normal
				db.createPost(postInfo, function(err, data) {
					if (data) {
						res.send({ success: true, data: postInfo, user: req.session.username });
					} else {
						res.send({ success: false, data: null, user: req.session.username });
					}
				});
			}
		}
	});
};

/** Removes a post when the user clicks remove post button
 */
var removePost = function(req, res) {
	var postInfo = {
		post_id: req.body.postId,
		username: req.session.username
	};
	
	db.removePost(postInfo, function(err, data) {
		if (err) {
			console.log(err);
			res.send({success: false});
		} else {
			res.send({success: true});
		}
	});
};

/** Creates a comment when the user clicks the "post comment" button
 */
var createComment = function(req, res) {
	var commentInfo = {
		comment: req.body.comment,
		username: req.session.username,
		commentId: new Date().getTime(),
		postId: req.body.postId
	};

	db.createComment(commentInfo, function(err, data) {
		if (data) {
			res.send({ success: true, data: commentInfo });
		} else {
			res.send({ success: false, data: null });
		}
	});

};

/** When a post is liked, update the dynamodb table with its new value
 */
var likePost = function(req, res) {
	var postInfo = {
		username: req.session.username,
		postId: req.body.postId,
		poster: req.body.poster
	};

	db.likePost(postInfo, function(data) {
		if (data) {
			res.send({ success: true });
		} else {
			res.send({ success: false });
		}
	});
};


/** Routes accessible by app.js
 */
var routes = {
	getLogin: getLogin,
	getSignup: getSignup,
	getLogout: getLogout,
	getFriendsPage: getFriendsPage,
	getFriends: getFriendsData,
	getOnlineFriends: getOnlineFriendsData,
	getInterests: getInterests,
	getAllAffiliations: getAllAffiliations,
	postSearchSuggestions: postSearchSuggestions,
	postNewsSuggestions: postNewsSuggestions,
	addFriend: addFriend,
	removeFriend: removeFriend,
	handleFriendRequest: handleFriendRequest,
	checkLogin: checkLogin,
	createAccount: createAccount,
	getHome: getHome,
	getMessages: getMessages,
	postMessage: postMessage,
	postEditChatName: postEditChatName,
	postAddMembers: postAddMembers,
	postRemoveChat: postRemoveChat,
	getProfile: getProfile,
	getProfileEdit: getProfileEdit,
	postEditInterests: postEditInterests,
	postEditPassword: postEditPassword,
	postEditEmail: postEditEmail,
	postEditAff: postEditAff,
	createPost: createPost,
	removePost: removePost,
	createComment: createComment,
	getPosts: getHomePosts,
	getProfilePosts: getProfilePosts,
	likePost: likePost,
	getNewsFeed: getNewsFeed
};

module.exports = routes;
