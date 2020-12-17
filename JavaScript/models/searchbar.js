// function that does search bar

$(document).ready(function() {
	// Generate search suggestions for each key typed
	$("#searchInput").keyup(function() {
		var input = $("#searchInput").val();
		if (input == '') {
			$("#searches").empty();
			return;
		}
		$.post("/searchsuggestions", { input: input }, function(data) {
			if (data.success) {

				// Empty the current searches and get the users that were queried
				$("#searches").empty();
				let users = data.suggestions;

				// use an array to track who is displayed so far so we don't have duplicates
				let usersShown = [];

				// for each user, display it and give it proper properties
				for (var i = 0; i < users.length; i++) {

					// extract properties and check if the user was already shown
					let username = users[i].username.S;
					let aff = users[i].affiliation.S;
					if (usersShown.includes(username) || data.user === username) {
						continue;
					} else {
						usersShown.push(username);
					}

					// cut off names that are too long to ensure they fit on the line
					let name = users[i].first_name.S + ' ' + users[i].last_name.S;
					let sub_name = name;

					if (name.length > 10) {
						sub_name = name.substr(0, 8);
						sub_name = sub_name + '..';
					}

					// create the suggestion
					let suggestion = '<div>' +
						'<p>' +
						'<img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="35px"></img> ' +
						'<button id="search' + i + '" class="btn btn-outline-dark">' + sub_name + '</button>'
					'</p>' +
						'</div>';

					// append the suggestion to the searches column
					$("#searches").append(suggestion);

					// add click listener to load user page on their button

					$("#search" + i).click(function() {
						$("ul").empty();
						$("li").empty();
						$("#friendDisplay").empty();
						$("#profDisplay").empty();
						$.post('/getprofileposts', { searchedUser: username }, function(data) {
							$("#statusForm").hide();
							// create the header for the searched user
							var header = '<div class="bs-example jumbotron">' +
								'<h4 class="display-8">' +
								'<img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="75px"></img>' +
								'</h4>' +
								'<p class="lead" style="color: #0086FF; text-align: center;">' +
								'<a id="usernameField">' + username + '</a> <br></br>' +
								'<a id="affField" style="font-style: italic;"> affiliated with: ' + aff + '</a> <br></br>' +
								'<button id="addFriend" class="btn btn-outline-success">Add Friend</button>' +
								'<b></b><div id="friendAlert"></div>' +
								'</p>' +
								'</div>';
							$("li").append(header);

							// create the "post to friend's wall' sub-header below header
							var subHeader = '<div class="bs-example jumbotron" id="statusForm">' +
								'<form onsubmit="return false;">' +
								'<h4 class="display-8">what' + "'s on your mind, " + data.user + '?</h4>' +
								'<hr class="my-4">' +
								'<p><input type="text" id="postInput' + username + '" name="myPost"></p>' +
								'<p><button type="submit" id="postButton' + username + '" class="btn btn-outline-dark">post to ' + username + "'" + 's wall</button></p>' +
								'</form>' +
								'</div>';

							$("li").append(subHeader);

							// add an onclick request to post on the searched user's wall
							$("#postButton" + username).click(function() {
								$.post("/createpost",
									{
										post: $("#postInput" + username).val(),
										postedTo: username
									},
									function(data) {
										if (data.success) {
											let thisPostId = data.data.postId;
											let poster = data.data.username;
											var asyncPost = '<div id="' + thisPostId + '" class="bs-example jumbotron">' +
												'<h4 class="display-8"><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="75px"></img><b>' + data.data.username + ' posted on ' + username + "'s wall" + '</b></h4>' +
												'<p class="lead" style="color:#0086FF; text-align: center;"><i>' + data.data.post + '</i></p>' +
												'<hr class="my-4">' +
												'<p id="commentSection' + thisPostId + '"><b><u>comments</u></b><br></br></p>' +
												'<hr class="my-4">' +
												'<form onsubmit="return false;">' +
												data.user + ': <input type="text" id="commentInput' + thisPostId + '" name="myComment"> ' +
												'<input type="hidden" id="postIdInput' + thisPostId + '" name="postId" value="' + thisPostId + '">' +
												'<button type="submit" class="btn btn-outline-dark" id="commentButton' + thisPostId + '">comment</button> ' +
												'<button type="submit" class="btn btn-link" id="likeButton' + thisPostId + '"><img src="https://cdn2.iconfinder.com/data/icons/facebook-ui-colored/48/JD-22-512.png" width="50px" height="50px"/></button> <button class="btn btn-outline-primary" id="likeOutput' + thisPostId + '">0</button>  ' +
												'</form>' +
												'<p><button type="button" id="removeButton' + thisPostId + '" class="btn btn-outline-danger"">remove post</button></p>' +
												'</div>';
											$("ul").prepend(asyncPost);
											// add functionality for remove button
											$("#removeButton" + thisPostId).click(function() {
												$.post('/removepost', {
													postId: thisPostId
												}, function(data) {
													if (data.success) {
														$("#" + thisPostId).hide();
													} else {
													}
												});
											});
											// add functionality for like button
											$("#likeButton" + thisPostId).click(function() {
												$.post('/likepost', { postId: thisPostId, poster: poster }, function(data) {
													if (data.success) {
														let currLikes = parseInt($("#likeOutput" + thisPostId).text());
														$("#likeOutput" + thisPostId).text(currLikes + 1);
													}
												});
											});
											// add functionality for comment button
											$("#commentButton" + thisPostId).click(function() {
												$.post("/comment",
													{
														comment: $("#commentInput" + thisPostId).val(),
														postId: $("#postIdInput" + thisPostId).val()
													},
													function(data) {
														if (data.success) {
															let asyncComment = '<p><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="25px"> ' + data.data.username + ': ' + data.data.comment + '</img></p>';
															$("#commentSection" + thisPostId).append(asyncComment);
															$("#commentInput" + thisPostId).val("");
														} else {
															// ADD BETTER ERROR IMPL
															alert('error');
														}
													});
											});
										} else {
											let alert =
												'<div class="alert alert-danger" role="alert">' +
												'stop trying to post, you aren' + "'" + 't even friends with them!' +
												'</div>';
											$("#friendAlert").empty();
											$("#friendAlert").append(alert)
										}
									});
							});
							// add functionality for the add friend button
							$("#addFriend").click(function() {
								$.post('/addfriend', { addFriendUser: username }, function(data) {
									if (data.success) {
										var alert =
											'<div class="alert alert-success alert-dismissible fade show" role="alert">' +
											'friend request sent!'
										'</div>';
										$("#friendAlert").empty();
										$("#friendAlert").append(alert)
									} else {
										var alert =
											'<div class="alert alert-danger" role="alert">' +
											'hmm, you cannot send another request to this user' +
											'</div>';
										$("#friendAlert").empty();
										$("#friendAlert").append(alert)
									}
								});
							});

							var posts = data.userPosts;
							var commentMap = data.postComments;
							var currUser = data.user;
							for (var i = 0; i < posts.length; i++) {
								let thisPostId = posts[i].post_id;
								let thisPost = posts[i].post;
								let thisUser = posts[i].username;
								let thisPostTo = posts[i].posted_to;
								let likes = posts[i].likes;
								// create the div element for the post and append it
								var post = '<div id="' + thisPostId + '"class="bs-example jumbotron">' +
									'<h4 class="display-8"><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="75px"></img><b> ' + thisUser + '</b> posted on <b>' + thisPostTo + "</b>'s wall" + '</h4>' +
									'<p class="lead" style="color:#0086FF; text-align: center;"><i>' + thisPost + '</i></p>' +
									'<hr class="my-4">' +
									'<p id="commentSection' + thisPostId + '"><b><u>comments</u></b><br></br></p>' +
									'<hr class="my-4">' +
									'<form onsubmit="return false;">' +
									currUser + ': <input type="text" id="commentInput' + thisPostId + '" name="myComment"> ' +
									'<input type="hidden" id="postIdInput' + thisPostId + '" name="postId" value="' + thisPostId + '">' +
									'<button type="submit" class="btn btn-outline-dark" id="commentButton' + thisPostId + '">comment</button> ' +
									'<button type="submit" class="btn btn-link" id="likeButton' + thisPostId + '"><img src="https://cdn2.iconfinder.com/data/icons/facebook-ui-colored/48/JD-22-512.png" width="50px" height="50px"/></button> <button class="btn btn-outline-primary" id="likeOutput' + thisPostId + '">' + likes +'</button>  ' +
									'</form>' +
									'<p><button type="button" id="removeButton' + thisPostId + '" class="btn btn-outline-danger"">remove post</button></p>' +
									'</div>';
								$("ul").append(post);

								// add functionality for remove button
								$("#removeButton" + thisPostId).click(function() {
									$.post('/removepost', {
										postId: thisPostId
									}, function(data) {
										if (data.success) {
											$("#" + thisPostId).hide();
										} else {
											alert('fail');
										}
									});
								});
								// add functionality for like button
								$("#likeButton" + thisPostId).click(function() {
									$.post('/likepost', { postId: thisPostId, poster: thisUser }, function(data) {
										if (data.success) {
											let currLikes = parseInt($("#likeOutput" + thisPostId).text());
											$("#likeOutput" + thisPostId).text(currLikes + 1);
										}
									});
								});
								// add functionality for the comment button
								$("#commentButton" + thisPostId).click(function() {
									$.post("/comment", {
										comment: $("#commentInput" + thisPostId).val(),
										postId: $("#postIdInput" + thisPostId).val()
									}, function(data) {
										if (data.success) {
											let comment = '<p><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="25px"> ' + data.data.username + ': ' + data.data.comment + '</img></p>';
											$("#commentSection" + thisPostId).append(comment);
											$("#commentInput" + thisPostId).val("");
										} else {
											// make a cute error alert
											alert('err comment');
										}
									});
								});
							}
							// for each comment already present before loading, append to the comment
							for (var i = 0; i < commentMap.length; i++) {
								let thisPostId = commentMap[i][0];
								let comments = commentMap[i][1];
								for (var j = 0; j < comments.length; j++) {
									let comment = '<p><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="25px"> ' + comments[j].username.S + ': ' + comments[j].comment.S + '</img></p>';
									$("#commentSection" + thisPostId).append(comment);
									$("#commentInput" + thisPostId).val("");
								}
							}
						});
					});
				}
			} else {
				// failure handling error alert
			}
		});
	});
});