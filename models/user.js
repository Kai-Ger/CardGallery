var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

// SCHEMA SETUP
var UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, require: true },
    email: { type: String, unique: true, require: true },
    password: String,
    resetPassToken: String,
    resetPassExpires: Date,
    isAdmin: { type: Boolean, default: false }
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
