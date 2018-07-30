var mongoose = require("mongoose");

// SCHEMA SETUP
var cardSchema = new mongoose.Schema({
    name: String,
    image: {
        url: String,
        public_id: String
    },
    description: String,
    amount: Number,
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
      }
   ],
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    }
});

module.exports = mongoose.model("Card", cardSchema);
