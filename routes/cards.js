var express = require("express");
var router = express.Router();
var multer = require("multer");
var Card = require("../models/card");
var Comment = require("../models/comment");
var config = require("../../config"); // temporary
var storage = multer.diskStorage({
    filename: function(request, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});

// Image type validation
var imageFilter = function(request, file, callback) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return callback(new Error("Only image files are allowed!"), false);
    }
    callback(null, true);
};

// MULTER config
var upload = multer({ storage: storage, fileFilter: imageFilter });

// CLOUDINARY config
var cloudinary = require("cloudinary");
cloudinary.config({
    cloud_name: config.cloudinary_cloud_name,
    api_key: config.cloudinary_api_key,
    api_secret: config.cloudinary_api_secret
});

// INDEX - display all grounds
router.get("/", function(request, response) {
    var perPage = 4;
    var pageQuery = parseInt(request.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    if (request.query.search) {
        const regex = new RegExp(escapeRegex(request.query.search), "gi");
        Card.find({ name: regex }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCards) {
            Card.countDocuments({ name: regex }).exec(function(err, count) {
                if (err) {
                    console.log(err);
                    response.redirect("back");
                }
                else {
                    var noMatch = false;
                    if (allCards.length == 0) {
                        noMatch = true;
                    }
                    response.render("cards/index", {
                        cards: allCards,
                        current: pageNumber,
                        noMatch: noMatch,
                        pages: Math.ceil(count / perPage),
                        search: request.query.search,
                        page: 'cards'
                    });
                }
            });
        });
    }
    else {
        Card.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCards) {
            Card.countDocuments().exec(function(err, count) {
                if (err) {
                    console.log(err);
                }
                else {
                    response.render("cards/index", {
                        cards: allCards,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: false,
                        page: 'cards',
                        search: false
                    });
                }
            });
        });
    }
});

// SHOW - display single card inner page
router.get("/:id", function(request, response) {
    Card.findById(request.params.id).populate("comments").exec(function(err, foundCard) {
        if (err || !foundCard) {
            console.log(err);
            request.flash("error", "Card not found");
            response.redirect("back");
        }
        else {
            response.render("cards/show", { card: foundCard });
        }
    });
});

// safeguard against regex DDoS attack
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}


module.exports = router;
