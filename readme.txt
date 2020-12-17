a pretty decent team consists of:

1) Davis Tran (davisdt)
2) Saurabh Shah (surb)
3) Zach Szekeres (zszeke)
4) Jimmy Ni (jimmyni)

********************************************
Description of features implemented:

Account Creation / SignIn: Users can sign into their 
accounts when they first log onto the website. 
Their password is hashed and compared to the hashed password 
stored in the database. If they choose to create a new account, 
they enter a range of options. Creating a new account adds them 
to the database, and adds their prefixes to the prefix database 
(as described in search bar implementation). 

Navbar: Users may navigate from home page, chat, news feed, profile page,
 friends page, or log out. We use a simple get function to render each page. 
The navbar is sticky and indicates which current page the user is on.

Home Page: The home page allows users to see all of their own posts and all
 of their friend’s posts (to anyone’s walls). Posts are retrieved 
 and rendered using models/postRetrieval.js. Comments are also 
 retrieved and rendered, as well as various types of information 
 about their posts. They are able to post status updates which 
 update asynchronously, along with remove, comment, and like posts. 
 Users can only like a post once and they can only remove their own 
 posts or any posts that users have posted on their walls. The left 
 hand side shows their currently online friends and the right hand 
 side shows their searches that appear after typing in the search bar 
 in the top right corner of the screen. Asynchronous requests were 
 handled using JQuery and Ajax.

Friend Page: Upon loading, users will be met with a visualization 
of their friend/affiliation network. On the left column, users will 
be able to see all the pending friend requests as they come in and 
will be able to reject or accept the friend request. The right hand 
side again will show your current searches which you can use the 
search bar in the top right to populate. Scrolling down below the 
visualizer, you will see a list of your current friends. From here, 
you can delete any friends that you do not wish to have anymore, 
and they will delete from the visualizer and list immediately. 
Asynchronous requests were handled using JQuery and Ajax.

Profile Page: The profile page allows users to see all of their 
own status posts (to their own walls) and all posts that their 
friends have posted on their walls. The profile page does not show 
the same posts as the home page, as it removes posts from your friends 
that have nothing to do with you and it also removes your posts on other
 people’s walls, as those shouldn’t have a relation to your own profile 
 wall. Posts and comments are rendered and displayed using 
 models/profilePostRetrieval.js, which adds all of the post information
  and functionality to the page. The left column of this page will show
   your name, current affiliation and a list of your interests. 
   The right hand column is again a search feature that will show up
    your searches as you type them. The profile page gives you an option 
    to edit your account, which lets you change your email, password, 
    affiliation, or add interests. Adding interests/affiliation will 
    direct you back to the profile page and will populate the left hand 
    columns immediately. Asynchronous requests were handled using JQuery 
    and Ajax.

Friend Visualizer: The friend visualizer was implemented using 
Cytoscape.js, a graph visualization library. In order to implement 
the visualizer, nodes were separated into three categories: current 
user, friends, and affiliated. Edges were also split into two categories, 
friend and affiliation. The current user is shown in the middle of the 
graph in purple and is unclickable. Friends are shown in orange, and are 
connected to the current user using the light-blue friendship edges. 
Friends may also have dark-blue edges connecting them to the current user,
 representing that these users have the same affiliation as the current 
 user. Finally, yellow nodes are nodes that share the same affiliation as
  the current user but are not already friends with the current user. 
  When the friends page is first loaded, the graph only contains 
  connections from the current user to their direct friends. You can then 
  click on any friend to add friends of your friend who share your 
  affiliation as yellow nodes to the graph. These yellow nodes can further
   be right clicked on the send a friend request, which allows you to 
   effectively expand your network. You cannot further expand on yellow 
   nodes by clicking on them, as we determined that this would be a 
   privacy issue, as you should only be able to see the friends of your 
   friends and not be able to go farther unless you add them as a friend 
   first. This is slightly different than what the handout suggests, 
   but is still an effective implementation and was approved via Piazza.

User Search Bar: The search bar interacts with several 
tables in DynamoDB and through the script that is run on 
corresponding pages pointing to models/searchbar.js. When a 
user is created, prefixes of their first and last name are 
added to the “prefixes” table in DynamoDB. This table associates 
prefixes with a corresponding username and therefore account. For 
example, a user named Bob Smith would have prefixes “b”, “bo”, “bob”,
 “s”, “sm”, “smi”, “smit”, “smith” added to the table. The searchbar.js 
 uses this table to show suggestions and manage requests. After any key 
 is pressed, we split the input text on spaces, allowing us to isolate
  keywords searched. We then query the prefix table for each of these 
  keywords and collect our results. For each result, we will populate 
  the right column with a suggestion, cutting off names that are too 
  long with periods to ensure readability. Duplicates are removed in this
   process and the current user’s name is also filtered out in 
   the search. The suggestions are implemented as a clickable button,
    allowing the user to click on a suggested user to load their profile.
     After clicking on a user, you are able to post to their wall 
     (only if you are their friend), send a friend request to a user,
      and view their wall.
      
Friend Requests: Friend requests are done by adding an extra column 
to each user’s DynamoDB table for friend requests. This attribute 
is a string set containing all friend requests and is a set to not 
contain duplicates. There are two ways to add a friend: by searching
 a user’s profile and clicking the “add friend” button or by using 
 the friend visualizer and right clicking on a yellow node. Either 
 action will send a friend request to the user, and the user that it 
 was sent to can check their friend page to see their current friend 
 requests on the left column. From here, friend requests can either 
 be accepted or rejected. A rejected friend request will delete the 
 friend request from the database and is asynchronously removed from 
 the page. Accepting the friend request updates the database to remove 
 the friend request and simultaneously add you to your friend’s 
 friend list and your friend to your friend list.

Profile Edits: Nothing super fancy here, just a simple form where 
users can edit their email, affiliation, interests, etc. We 
used the same logic to post when users changed interests and/or 
affiliation below. We have a separate route for each type of change
(e.g. 1 route for a password change, 1 for email etc), mostly because 
we felt this was easier to handle on the backend, instead of parsing 
through to see which of the elements the user actually filled out,
 we can make the assumption that the entered something. Submitting 
 the form triggers a Dynamo update and a post to be made. 
 
 Chat: The first step to chat functionality is keeping 
 track of which of the user’s friends are online. This is 
 done by adding a timestamp to each user’s session that is 
 then propagated to the user’s last_active attribute in the 
 users table. By keeping track of all the users in this way, 
 we are able to set a threshold of 15 minutes to consider a 
 user as being “online”. 

The second step to chat functionality is communication between 
the server and the clients. This is done using socket.io. Each 
user in the users table contains a set of chat ids corresponding 
to the chats that they are a part of, and each chat in the chats 
table contains a set of usernames corresponding to the members of 
the specified chat. When a user sends a message to a chat, it runs 
an AJAX request to update the fields of the chat in the database 
with the new chat message while also sending the message to the 
server that is listening. The server then sends the new message 
along with the specified chat id to all the clients connected to 
the specific chat socket which then runs functions that update 
the client side HTML elements. Similarly, we used database accesses 
via AJAX requests and communication via socket.io to implement the 
creation and removal of chats as well as the addition of new chat 
members and chat naming.
 
News Feed: We implemented the adsorption algorithm via a series 
of spark operations on RDD’s (mostly mapping pairs to pairs to 
simulate things like label propagation and normalization etc). 
Once we got a list of labels for each node we constructed a 
probability mass function from which to pull the articles. 
We have a Livy job responsible for running the adsorption 
algo and for computing the probability mass function. We used 
this mass function to suggest articles to the user. We use a 
table for the articles which has relevant information such as 
the headline, link, date and category to build the “ac”, and 
“ca” edgrs. We also use the users table, namely the columns for 
friends, interests, to build the “au” “ac” and “uu'' edges. 

********************************************
Extra credit:

Friend requests - Users can look up a user and are able to add 
the user as a friend on most pages. The other user will receive 
the request on the friend page and choose to accept or deny. 

Deleting posts - Users are able to delete their own posts, but 
not others. For increased privacy reasons, any posts that include
 a certain user allows that particular user to delete that particular 
 post, whether it be posted on another user’s wall or their own. 

Liking posts - The project writeup does not say to add likes 
anywhere (regarding posts), so we allowed users to like a post 
when they see one once. The number of likes is displayed

Visualizer Add Friends - When yellow users are right-clicked 
you can send a friend request to them to expand your network.

Multiple Chats - While on the messages page, a user can be 
in multiple chats at the same time, and multiple chats will 
update with new messages on the client side in real time. 
However, only the selected chat div’s message history is shown.

Chat names - We allowed users to name their group chats while 
also allowing for multiple chats to have the same people. 
We wanted to be able to allow users to create multiple chats 
with the same people as there are use cases for wanting to set 
aside different chats for different conversations.

********************************************
List of Source Files Included:

JavaScript  
	- app.js  
	- models
		- chat.js, hashing.js, profilePostRetrieval.js, visualizer.js, database.js, postRetrieval.js, searchbar.js
	- routes
		- routes.js
	- package.json  
	- package-lock.json
	- views   routes  views
		- friends.ejs, main.ejs, newsfeed.ejs, profile.ejs, style.css, home.ejs, messages.ejs,
		  profileEdit.ejs, signup.ejs
		  
Spark
	- assembly 
	- native-libs 
	- pom.xml 
	- src 
		- edu
			- upenn
				-cis
					-nets212
						-config
						-livy
						-rec
						-storage
		- test
	- target

readme.txt  

********************************************
Declaration:

All of the code written for book was written by us and only us.

********************************************
Instructions for building and running the project

set up these tables: 
articles: 
Partition key: article_id (hashcode of the headline) (number)
Also has: headline, link, category, date

chats 
Partition key (chat_id ) (number)
Also has: last_message, last_message_time, message_history, members, chat_name

comments
Partition key: post_id (time stamp of the post) (number)
Sort key: comment_id (number)
Also has: username, comment 

keywords
Partition key: article_id (same as above | number)
Sort key: keyword (string)
Also has: headline, link (this is for article search)

posts 
Partition key: username (String)
Sort key: post_id (Number)
Also has: post, posted_to (which wall is it posted on), liked_by (who liked the post), likes (num likes)

prefixes
Partition key: prefix (String)
Sort key: username (String) 
Also has: first_name, last_name, affiliation

user 
Partition key: username 
Also has all other user info: affiliation, birthday, chats, email, first_name, friendRequests, friends, interests, articles liked, last_name, password, salt, last_active 


After that:

1. run Loader and Loader2 in the Spark project to populate two of those tables. make sure you thave the file archive.txt which is the text file of all the json strings of articles.
2. npm install, mvn install/compile
3. run node app.js when cd'd into JavaScript file
