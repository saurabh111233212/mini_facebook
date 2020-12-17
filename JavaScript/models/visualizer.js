/** Code for the visualizer shown in friends.ejs
 */
$(document).ready(function() {
	$.get("/frienddata", function(data) {

		// Create the initial graph using the current user's friend group
		var user = data.user;
		var friends = data.friends;
		var userAff;
		var userAffs;

		// Get affiliation information as well as friend information
		$.get("/affiliations", function(aff) {
			// Extract the current userAff as well as splice this to include only other users
			for (var i = 0; i < aff.length; i++) {
				if (aff[i].user === user) {
					userAff = aff[i].affiliation;
					aff.splice(i, 1);
				}
			}
			userAffs = aff;

			var nodes = [];
			var edges = [];

			// Create initial user node
			nodes.push({
				group: 'nodes',
				data: { id: user, type: "curr" }
			});

			// for each friend, create a node and edge to them
			for (var i = 0; i < friends.length; i++) {
				nodes.push({
					group: 'nodes',
					data: { id: friends[i], type: "friend" }
				});

				edges.push({
					group: 'edges',
					data: { id: user + friends[i], source: user, target: friends[i], type: "friend" }
				});
			}

			// for each friend, check to see if they have a matching affiliation and make an edge if so
			for (var i = 0; i < userAffs.length; i++) {
				let affiliated = userAffs[i].user;
				let aff = userAffs[i].affiliation;
				if (userAff === aff) {
					// first ensure that there is a node for this user for the edge
					if (friends.includes(affiliated)) {
						// create the affiliation edge
						edges.push({
							group: 'edges',
							data: { id: user + affiliated + aff, source: user, target: affiliated, type: "affiliation" }
						});
					}
				}
			}

			// create the graph with given nodes/edges
			var cy = cytoscape({

				container: document.getElementById('vis'), // container to render in

				elements: {
					nodes: nodes,
					edges: edges
				},

				style: [ // the stylesheet for the graph
					{
						selector: 'node[type="curr"]',
						style: {
							'background-color': '#967bb6',
							'label': 'data(id)'
						}
					},

					{
						selector: 'node[type="friend"]',
						style: {
							'background-color': '#E68059',
							'label': 'data(id)'
						}
					},

					{
						selector: 'node[type="affiliated"]',
						style: {
							'background-color': '#dbc300',
							'label': 'data(id)'
						}
					},

					{
						selector: 'edge[type="friend"]',
						style: {
							'width': 3,
							'line-color': '#99CAF6',
							'curve-style': 'bezier'
						}
					},

					{
						selector: 'edge[type="affiliation"]',
						style: {
							'width': 3,
							'line-color': '#224a6e',
							'curve-style': 'bezier'
						}
					}
				],

				layout: {
					name: 'cose'
				},

				autoungrabify: true,
				maxZoom: 2,
				minZoom: .5
			});

			// on click for adding affiliated nodes as friends
			cy.on('cxttap', 'node[type="affiliated"]', function(event) {
				var node = event.target;
				$.post('/addfriend', { addFriendUser: node.id() }, function(data) {
					if (data.success) {
						var alert = '<div class="alert alert-success alert-dismissible fade show" role="alert">' +
							'friend request sent!'
						'</div>';
						$("#friendAlert").empty();
						$("#friendAlert").append(alert)
					} else {
						var alert =
							'<div class="alert alert-warning" role="alert">' +
							'hmm, you cannot send another request to this user' +
							'</div>';
						$("#friendAlert").empty();
						$("#friendAlert").append(alert)
					}
				});
			});

			//on click to add affiliation edges
			cy.on('click', 'node[type="friend"]', function(event) {
				var node = event.target;

				$.post('/frienddata', { searchedUser: node.id() }, function(data) {
					let clickedUser = data.user;
					let clickedUserFriends = data.friends;
					// For each of the clicked user's friends, see who has the same affililation
					// as the user in the middle of the graph
					let sameAffUsers = [];
					let newNodes = [];
					let newEdges = [];
					for (var i = 0; i < userAffs.length; i++) {
						// if a user is friends with the node who was clicked & shares same affiliation as the center user
						// and is not already a direct friend of the center user
						if (clickedUserFriends.includes(userAffs[i].user) && userAff === userAffs[i].affiliation && !friends.includes(userAffs[i].user)) {
							// create a new affiliated node for them
							newNodes.push({
								group: 'nodes',
								data: { id: userAffs[i].user, type: "affiliated" }
							});
							// create an edge from the friend who was clicked on to the affiliated node
							newEdges.push({
								group: 'edges',
								data: { id: clickedUser + userAffs[i].user, source: clickedUser, target: userAffs[i].user, type: "affiliation" }
							});
						}
					}
					cy.add(newNodes);
					cy.add(newEdges);

					let layout = cy.elements().layout({
						name: 'cose'
					});
					layout.run();
				});
			});
		});
	});
});