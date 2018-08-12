var mongoose = require("mongoose");

// SCHEMA SETUP
var cardSchema = new mongoose.Schema({
    name: String,
    image: {
        url: String,
        public_id: String
    },
    description: String,
    amount: { type: Number, default: 0 },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
       }
   ]
});

module.exports = mongoose.model("Card", cardSchema);
