var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

// SCHEMA SETUP
var UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, require: true },
    email: { type: String, unique: true, require: true },
    password: String,
    introduction: String,
    resetPassToken: String,
    resetPassExpires: Date,
    isAdmin: { type: Boolean, default: false },
    wishesCount: { type: Number, default: 0 },
    wishes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card"
        }
    ],
    sentCardsCount: { type: Number, default: 0 },
    sentCards: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card"
        }
    ]
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
