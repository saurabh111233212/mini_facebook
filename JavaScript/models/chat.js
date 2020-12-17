var submitButton = document.getElementById('chat-submit');
var chatMessages = document.querySelector('.chat-messages');
var chatList = document.getElementById('chats').children;
var selectedChatID = -1;
var selectedChatMembers = [];
var selectedChatName = "";

var socket = io();

/* MESSAGES FROM SERVER
*/
socket.on('chat_message', (data) => {

	// Update last message shown in chat tab
	for (var i = 0; i < chatList.length; i++) {
		var chatDiv = chatList[i];
		// First child element of chatList[i] should be the chat-id-div
		if (chatDiv.firstElementChild.getAttribute('chat-id') == data.chat_id) {
			// Create message in chatbox only if that chat div is selected
			if (chatDiv.classList.contains('selected')) {
				createMessage(data);
			}

			// Update the client side msgHistory
			var newMsgHistory = [];
			if (chatHistories[i].message_history.S) {
				newMsgHistory = JSON.parse(chatHistories[i].message_history.S);
			}
			var newMsg = { username: data.username, text: data.text, time: data.time };
			newMsgHistory.push(newMsg);
			chatHistories[i].message_history.S = JSON.stringify(newMsgHistory);

			// Set the fields of the chat div
			var sub_header = chatDiv.children["msg-div"].children["sub-header"];
			var sub_header_time = chatDiv.children["msg-div"].children["sub-header-time"];
			sub_header.innerHTML = data.username + ": " + data.text;
			sub_header_time.innerHTML = "[" + data.time + "]";
		}
	}

	// Scroll down
	chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('chat_name_change', (data) => {
	// Update chat_name in chat tab
	for (var i = 0; i < chatList.length; i++) {
		var chatDiv = chatList[i];
		// First child element of chatList[i] should be the chat-id-div
		if (chatDiv.firstElementChild.getAttribute('chat-id') == data.chat_id) {
			// Set the field of the chatDiv
			var header = chatDiv.children["msg-div"].children["header"];
			header.innerHTML = data.chat_name;
		}
	}
});

/* RUN ON RENDER
*/
// initial set up of chat div onclicks
setOnClicks();
// click on the first chat div
if (chatList[0]) {
	chatList[0].click();
}

// Message submit
submitButton.addEventListener('submit', e => {
	// Prevent from going to URL
	e.preventDefault();

	if (selectedChatID == -1) {
		// Alert if no chat is selected.
		alert("Please select a chat to send the message to. You can invite online friends to chat by clicking on their username.");
	}
	else {
		//time in database is formatted differently so it can be naturally sorted
		document.getElementById('timeOfMessage').value = moment().format();

		// Set time of message for chat
		var currTime = moment().format('MMM Do YYYY, h:mm a');

		// Use ajax to send post request
		$.ajax({
			type: 'POST',
			url: '/postmessage',
			data: $('form').serialize(),
			success: function() {
				console.log("Message was sent");
			},
			error: function() {
				console.log("Message was not sent");
			}
		});

		// Get message text
		let msg = e.currentTarget.elements['msg'].value;

		msg = msg.trim();

		if (!msg) {
			return false;
		}

		// Emit message to server
		socket.emit('chat_message', { chat_id: selectedChatID, username: username, text: msg, time: currTime });

		// Clear input
		e.target.elements.msg.value = '';
		e.target.elements.msg.focus();
	}
});

// Set all the onclick functions
function setOnClicks() {
	for (var i = 0; i < chatList.length; i++) {
		(function(j) {
			// Chat on-clicks
			chatList[j].onclick = function() { chatClickFunc(j) };
			// Edit icon on-clicks
			chatList[j].children['icon-div'].children['edit-div'].onclick = function() { editClickFunc(j) };
			// Plus icon on-clicks
			chatList[j].children['icon-div'].children['plus-div'].onclick = function() { plusClickFunc(j) };
			// Trash icon on-clicks
			chatList[j].children['icon-div'].children['trash-div'].onclick = function() { trashClickFunc(j) };
		})(i);
	}
}

function chatClickFunc(i) {
	var currDiv = chatList[i];

	// Set current chat info
	selectedChatID = currDiv.children['chat-id-div'].attributes['chat-id'].value;
	selectedChatMembers = currDiv.children['chat-id-div'].attributes['members'].value;
	selectedChatName = currDiv.children['chat-id-div'].attributes['chat-name'].value;

	submitButton.elements['selectedChatID'].value = selectedChatID;
	submitButton.elements['selectedChatMembers'].value = selectedChatMembers;
	submitButton.elements['selectedChatName'].value = selectedChatName;

	// Change color of div on click and add selected class name
	deselectDivs();
	currDiv.style.backgroundColor = '#99CAF6';
	currDiv.classList.add('selected');

	// Load chat in chatbox
	deletePrevMessages();
	var msgHistory = [];
	if (chatHistories[i].message_history.S) {
		msgHistory = JSON.parse(chatHistories[i].message_history.S);
	}

	msgHistory.forEach(msg => {
		createMessage(msg);
	});

	// Scroll down
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function editClickFunc(i) {
	if (!chatList[i].children['msg-div'].children['sub-header'].innerHTML) {
		alert("Please send a message first before naming the chat.");
	}
	else {
		var chat_name = prompt("What would you like to rename this chat?");
		if (chat_name != null && chat_name.trim() != "") {
			chat_name = chat_name.trim();
			var chat_id = chatList[i].children['chat-id-div'].attributes['chat-id'].value;
			var post_data = {
				chat_id: chat_id,
				chat_name: chat_name

			}

			// Use ajax to send post request
			$.ajax({
				type: 'POST',
				url: '/posteditchatname',
				data: post_data,
				success: function() {
					console.log("Chat name was edited");
				},
				error: function() {
					console.log("Chat name was not edited");
				}
			});

			// Emit new name to server
			socket.emit('chat_name_change', { chat_id: chat_id, chat_name: chat_name });
		}
	}
}

function plusClickFunc(i) {
	if (!chatList[i].children['msg-div'].children['sub-header'].innerHTML) {
		alert("Please send a message first before adding more members.");
	}
	else {
		// Use ajax to send get request
		$.ajax({
			type: 'GET',
			url: '/onlinefrienddata',
			success: function(data) {
				var onlineFriends = data.friends;
				var peopleToAdd = prompt("Who would you like to add to a group chat?\n" +
					"Specify usernames separated by commas (e.g. fred,tom,winnie).\n" +
					"Available friends online:\n\n" + onlineFriends.join('\n') + "\n\n");
				var difference = peopleToAdd.split(",").filter(x => !onlineFriends.includes(x));
				if (peopleToAdd != null && peopleToAdd.trim() != "" && !difference.length) {
					var chat_id = chatList[i].children['chat-id-div'].attributes['chat-id'].value;
					var post_data = {
						chat_id: chat_id,
						people_to_add: peopleToAdd.split(",")
					}
					// Use ajax to send post request
					$.ajax({
						type: 'POST',
						url: '/postaddmembers',
						data: post_data,
						success: function() {
							console.log("New members were added");
						},
						error: function() {
							console.log("New members were not added");
						}
					});
				}
			},
			error: function() {
				console.log("Error getting online friends");
			}
		});
	}
}

function trashClickFunc(i) {
	if (!chatList[i].children['msg-div'].children['sub-header'].innerHTML) {
		alert("Please send a message first before deleting the chat.");
	}
	else {
		var confirmation = confirm("Delete this chatbox?");
		if (confirmation) {
			var chat_id = chatList[i].children['chat-id-div'].attributes['chat-id'].value;
			var post_data = {
				chat_id: chat_id
			}
			// Use ajax to send post request
			$.ajax({
				type: 'POST',
				url: '/postremovechat',
				data: post_data,
				success: function() {
					console.log("Chat was removed for user");
				},
				error: function() {
					console.log("Chat was not removed for user");
				}
			});
		}
	}
}

function deselectDivs() {
	for (var i = 0; i < chatList.length; i++) {
		chatList[i].style.backgroundColor = '';
		chatList[i].classList.remove('selected');
	}
}

// When user clicks on an online friend, create a chat
function friendClick(friend) {
	createChat([username, friend]);
}

// Output message to DOM
function createMessage(message) {
	var div = document.createElement('div');
	div.classList.add('message');
	var header = document.createElement('p');
	header.classList.add('meta');
	header.innerText = message.username;
	header.innerHTML += `<span>${message.time}</span>`;
	var para = document.createElement('p');
	para.classList.add('text');
	para.innerText = message.text;
	div.appendChild(header);
	div.appendChild(para);
	document.querySelector('.chat-messages').appendChild(div);
}

// Delete existing messages from DOM
function deletePrevMessages() {
	var messages = document.querySelector('.chat-messages');
	while (messages.firstChild) {
		messages.firstChild.remove()
	}
}

// Add chat to DOM
function createChat(members) {
	var div = document.createElement('div');
	div.classList.add('chat-div');

	var chat_id_div = document.createElement('div');
	chat_id_div.id = 'chat-id-div';
	chat_id_div.setAttribute('chat-id', Date.now().toString());
	chat_id_div.setAttribute('members', JSON.stringify(members));
	chat_id_div.setAttribute('chat-name', members.join(", "));

	var chat_div_wrapper_1 = document.createElement('div');
	chat_div_wrapper_1.id = 'msg-div';
	chat_div_wrapper_1.classList.add('chat-div-wrapper');

	var header = document.createElement('p');
	header.id = 'header';
	header.classList.add('header');
	header.innerText = members.join(", ");

	var sub_header = document.createElement('p');
	sub_header.id = 'sub-header';
	sub_header.classList.add('sub-header');
	sub_header.innerText = "";

	var sub_header_time = document.createElement('p');
	sub_header_time.id = 'sub-header-time';
	sub_header_time.classList.add('sub-header-time');
	sub_header_time.innerText = "";

	chat_div_wrapper_1.appendChild(header);
	chat_div_wrapper_1.appendChild(sub_header);
	chat_div_wrapper_1.appendChild(sub_header_time);

	var chat_div_wrapper_2 = document.createElement('div');
	chat_div_wrapper_2.id = 'icon-div';
	chat_div_wrapper_2.classList.add('chat-div-wrapper');

	var edit = document.createElement('div');
	edit.id = 'edit-div';
	edit.classList.add('edit');

	var edit_icon = document.createElement('i');
	edit_icon.classList.add('fas');
	edit_icon.classList.add('fa-edit');
	edit_icon.classList.add('fa-lg');

	edit.appendChild(edit_icon);

	var plus = document.createElement('div');
	plus.id = 'plus-div';
	plus.classList.add('plus');

	var plus_icon = document.createElement('i');
	plus_icon.classList.add('fas');
	plus_icon.classList.add('fa-plus');
	plus_icon.classList.add('fa-lg');

	plus.appendChild(plus_icon);

	var trash = document.createElement('div');
	trash.id = 'trash-div';
	trash.classList.add('trash');

	var trash_icon = document.createElement('i');
	trash_icon.classList.add('fas');
	trash_icon.classList.add('fa-trash');
	trash_icon.classList.add('fa-lg');

	trash.appendChild(trash_icon);

	chat_div_wrapper_2.appendChild(edit);
	chat_div_wrapper_2.appendChild(plus);
	chat_div_wrapper_2.appendChild(trash);

	div.appendChild(chat_id_div);
	div.appendChild(chat_div_wrapper_1);
	div.appendChild(chat_div_wrapper_2);

	var chats_div = document.getElementById('chats');
	chats_div.insertBefore(div, chats_div.firstElementChild);

	// add empty msg history
	chatHistories.unshift({
		chat_id: { S: "" },
		last_message: { S: "" },
		last_message_time: { S: "" },
		members: { SS: members },
		message_history: { S: "" },
		chat_name: { S: "" }
	});

	// reset onclicks
	setOnClicks();

	// click on the new chat div
	chatList[0].click();

}



