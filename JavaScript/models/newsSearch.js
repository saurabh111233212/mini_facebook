// implements news search bar
$(document).ready(function() {
	// When the user loads the page query their interests as search suggestions 
	// (yes, group didn't figure out how to integrate the alg, might as well have something :( )
	$.get('/getinterests', function(data) {
		let input_word = "";
		for (var i = 0; i < data.length; i++) {
			input_word += data[i] + " ";
		}
		$.post('/newssuggestions', { input: input_word }, function(data) {
			// clear the searches each click
			$("#myNews").empty();
			let suggestions = data.suggestions;

			// first we remove suggestions that have the same article attached to them
			suggestions = suggestions.filter(function(e) {
				if (!this[e.name]) {
					this[e.name] = true;
					return true;
				}
				return false;
			}, Object.create(null));

			// create the suggestions
			for (var i = 0; i < suggestions.length; i++) {
				// cut off headlines that are too long to ensure they fit on the line
				let name = suggestions[i].name;
				let sub_name = name;
				if (name.length > 65) {
					sub_name = name.substr(0, 63);
					sub_name = sub_name + '..';
				}
				let suggestion = '<div><p><a href="' + suggestions[i].link + '">' + sub_name + '</a> <button class="btn btn-link" id="likeButton' + sub_name + '"><img src="https://cdn2.iconfinder.com/data/icons/facebook-ui-colored/48/JD-22-512.png" width="50px" height="50px"/></button></p></div>';
				$("#myNews").append(suggestion);
			}
		});
	});

	// Add search suggestions when the user types / clicks the search bar
	$("#searchInput").keyup(function() {
		var input = $("#searchInput").val();
		if (input == '') {
			$("#myNews").empty();
			return;
		}
		$.post('/newssuggestions', { input: input }, function(data) {

			// clear the searches each click
			$("#myNews").empty();
			let suggestions = data.suggestions;

			// first we remove suggestions that have the same article attached to them
			suggestions = suggestions.filter(function(e) {
				if (!this[e.name]) {
					this[e.name] = true;
					return true;
				}
				return false;
			}, Object.create(null));

			// create the suggestions and track duplicates
			let duplicateTracker = [];
			for (var i = 0; i < suggestions.length; i++) {
				// cut off headlines that are too long to ensure they fit on the line
				let name = suggestions[i].name;
				let sub_name = name;
				if (!duplicateTracker.includes(name)) {
					duplicateTracker.push(name);
					if (name.length > 65) {
						sub_name = name.substr(0, 63);
						sub_name = sub_name + '..';
					}
					let suggestion = '<div><p><a href="' + suggestions[i].link + '">' + sub_name + '</a> <button class="btn btn-link" id="likeButton' + sub_name + '"><img src="https://cdn2.iconfinder.com/data/icons/facebook-ui-colored/48/JD-22-512.png" width="50px" height="50px"/></button></p></div>';
					$("#myNews").append(suggestion);
				}
			}
		});
	});
});