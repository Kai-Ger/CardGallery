var mongoose = require("mongoose");

// SCHEMA SETUP
var cardSchema = new mongoose.Schema({
    name: String,
    image: {
        url: String,
        public_id: String
    },
    description: String
});

module.exports = mongoose.model("Card", cardSchema);
