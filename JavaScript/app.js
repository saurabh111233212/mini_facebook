/* Initialization */

var express = require('express');
var routes = require('./routes/routes.js');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var app = express();

app.use(express.urlencoded());
app.use(cookieParser());
app.use(session({ secret: "booksarefornerds" }));

//set root directory for serving static files like style.css
app.use(express.static(__dirname));

app.get('/', routes.getLogin);
app.get('/signup', routes.getSignup);
app.get('/home', routes.getHome);
app.get('/messages', routes.getMessages);
app.get('/profile', routes.getProfile);
app.get('/logout', routes.getLogout);
app.get('/getposts', routes.getPosts);
app.get('/getprofileposts', routes.getProfilePosts);
app.get('/editprofile', routes.getProfileEdit);
app.get('/friends', routes.getFriendsPage);
app.get('/frienddata', routes.getFriends);
app.get('/onlinefrienddata', routes.getOnlineFriends);
app.get('/affiliations', routes.getAllAffiliations);
app.get('/getinterests', routes.getInterests);
app.get('/newsfeed', routes.getNewsFeed);

app.post('/getposts', routes.getPosts);
app.post('/getprofileposts', routes.getProfilePosts);
app.post('/frienddata', routes.getFriends);
app.post('/posteditpassword', routes.postEditPassword);
app.post('/posteditemail', routes.postEditEmail);
app.post('/posteditinterests', routes.postEditInterests);
app.post('/posteditaff', routes.postEditAff);
app.post('/checklogin', routes.checkLogin);
app.post('/createaccount', routes.createAccount);
app.post('/createpost', routes.createPost);
app.post('/removepost', routes.removePost);
app.post('/comment', routes.createComment);
app.post('/likepost', routes.likePost);
app.post('/addfriend', routes.addFriend);
app.post('/removefriend', routes.removeFriend);
app.post('/postfriendrequest', routes.handleFriendRequest);
app.post('/searchsuggestions', routes.postSearchSuggestions);
app.post('/newssuggestions', routes.postNewsSuggestions);
app.post('/postmessage', routes.postMessage);
app.post('/posteditchatname', routes.postEditChatName);
app.post('/postaddmembers', routes.postAddMembers);
app.post('/postremovechat', routes.postRemoveChat);

var server = app.listen(8080);
console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');

var io = require("socket.io")(server);

// for getting current time
var moment = require("moment");

//run when client connects

io.on('connection', socket => {
	console.log('New socket connection...');

	//listening for new message
	socket.on('chat_message', (data) => {
		//broadcast the new message
		io.emit('chat_message', { chat_id: data.chat_id, username: data.username, text: data.text, time: data.time });
	});

	//listening for chat name change
	socket.on('chat_name_change', (data) => {
		//broadcast the change
		io.emit('chat_name_change', { chat_id: data.chat_id, chat_name: data.chat_name});
	});
});

