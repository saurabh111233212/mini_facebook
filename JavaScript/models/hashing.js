/** This file will provide the basic hashing logic for any hashing usages for the project.
    We will use salt-hashing in order to hash necessary items.
 */
var crypto = require('crypto');

/** Hashing function using sha256 and the given salt to encode the input.
 */
var hash = function(input, salt) {
	let h = crypto.createHmac('sha256', salt).update(input);
	let val = h.digest('hex');
	return {
		hashedInput: val,
		salt: salt
	};	
};

/** Generates salt for use in hashing.
 */
var makeSalt = function(saltSize) {
	return crypto.randomBytes(Math.ceil(saltSize / 2)).toString('hex');
};

var hashing = {
	hash,
	makeSalt
};

module.exports = hashing;