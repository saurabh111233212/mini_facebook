/** This covers post retrieval for the pages!
 */
$(document).ready(function() {
	$.get("/getprofileposts", function(data) {
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
			var post = '<div id="' + thisPostId + '" class="bs-example jumbotron">' +
				'<h4 class="display-8"><img src="https://cdn.onlinewebfonts.com/svg/img_551225.png" width="75px"></img><b> ' + thisUser + '</b> posted on <b>' + thisPostTo + "</b>'s wall" + '</b></h4>' +
				'<p class="lead" style="color:#0086FF; text-align: center;"><i>' + thisPost + '</i></p>' +
				'<hr class="my-4">' +
				'<p id="commentSection' + thisPostId + '"><b><u>comments</u></b><br></br></p>' +
				'<hr class="my-4">' +
				'<form onsubmit="return false;">' +
				currUser + ': <input type="text" id="commentInput' + thisPostId + '" name="myComment"> ' +
				'<input type="hidden" id="postIdInput' + thisPostId + '" name="postId" value="' + thisPostId + '">' +
				'<button type="submit" class="btn btn-outline-dark" id="commentButton' + thisPostId + '">comment</button> ' +
				'<button type="submit" class="btn btn-link" id="likeButton' + thisPostId + '"><img src="https://cdn2.iconfinder.com/data/icons/facebook-ui-colored/48/JD-22-512.png" width="50px" height="50px"/></button> <button class="btn btn-outline-primary" id="likeOutput' + thisPostId + '">' + likes + '</button> ' +
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