var express = require("express");
var router = express.Router();
var multer = require("multer");
var async = require("async");
var Card = require("../models/card");
var User = require("../models/user");
var middleware = require("../middleware");
var mongoose = require("mongoose");
var config = require("../config");
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
    var perPage = 9;
    var pageQuery = parseInt(request.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    if (request.query.search) {
        const regex = new RegExp(escapeRegex(request.query.search), "gi");
        Card.find({ name: regex }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCards) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                Card.countDocuments({ name: regex }).exec(function(err, count) {
                    if (err) {
                        console.log(err);
                        response.render("someError");
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
            }
        });
    }
    else {
        Card.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCards) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                Card.countDocuments().exec(function(err, count) {
                    if (err) {
                        console.log(err);
                        response.render("someError");
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
            }
        });
    }
});


// NEW - show the form to create a new card
router.get("/new", middleware.adminPermissions, function(request, response) {
    response.render("cards/new");
});


// SHOW - display single card inner page
router.get("/:id", function(request, response) {
    async.waterfall([
        function(callback) {
            // Get card data
            Card.findById(request.params.id).populate("comments").exec(function(err, foundCard) {
                if (err || !foundCard) {
                    console.log(err);
                    return response.render("someError");
                }
                callback(err, foundCard);
            });
        },
        function(foundCard, callback) {
            // check whether user already wished for this card
            if (request.user != null) {
                User.findById(request.user.id).populate("wishes").exec(function(err, foundUser) {
                    if (err) {
                        console.log(err);
                        return response.render("someError");
                    }
                    else {
                        callback(err, foundCard, foundUser);
                    }
                });
            }
            else {
                var foundUser = null;
                callback(null, foundCard, foundUser);
            }
        },
        function(foundCard, foundUser, callback) {
            var wished = false;
            if (foundUser != null) {
                foundUser.wishes.forEach(function(wish) {
                    if (wish._id.equals(foundCard._id)) {
                        wished = true;
                    }
                });
            }
            callback(null, foundCard, wished);
        },
        function(foundCard, wished, callback) {
            // render page with appropriate wish 
            response.render("cards/show", { card: foundCard, wished: wished });
            callback(null);
        }
    ], function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
    });
});



// CREATE - add new card to dataBase
router.post("/", middleware.adminPermissions, upload.single("image"), function(request, response) {

    cloudinary.uploader.upload(request.file.path, function(result) {
        // add cloudinary image url to the card object
        request.body.card.image = {
            url: result.secure_url,
            public_id: result.public_id
        };
        request.body.card.description = request.sanitize(request.body.card.description);
        request.body.card.description = request.body.card.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
        // add new card object to database
        Card.create(request.body.card, function(err, newlyCreated) {
            if (err) {
                console.log(err);
                return response.render("someError");
            }
            response.redirect("/cards/" + newlyCreated.id);
        });
    });
    console.log(request.body.image);
});

// EDIT - edit existing card
router.get("/:id/edit", middleware.adminPermissions, function(request, response) {
    Card.findById(request.params.id, function(err, foundCard) {
        if (err) {
            console.log(err);
            return response.render("someError");
        }
        response.render("cards/edit", { card: foundCard });

    });
});


// ADD CARD to wishlist
router.post("/:card_id/wish", middleware.isLoggedIn, function(request, response) {
    User.findById(request.user._id, function(err, user) {
        if (err) {
            console.log(err);
            return response.render("someError");
        }
        else {
            Card.findById(request.params.card_id, function(err, card) {
                if (err) {
                    console.log(err);
                    return response.render("someError");
                }
                else {
                    user.wishes.push(card);
                    user.wishesCount = user.wishesCount + 1;
                    user.save();
                    request.flash("info", "Your wish was added successfully");
                    response.redirect("/cards/" + card._id);
                }
            });
        }
    });
});

// UPDATE - save edited card to database
router.put("/:id", middleware.adminPermissions, upload.single("image"), function(request, response) {
    if (request.file) {
        // delete image from cloud
        cloudDelete(request.params.id);
        cloudinary.uploader.upload(request.file.path, function(result) {
            // add cloudinary image url to the card object
            request.body.card.image = {
                url: result.secure_url,
                public_id: result.public_id
            };
            request.body.card.description = request.sanitize(request.body.card.description);
            request.body.card.description = request.body.card.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
            Card.findByIdAndUpdate(request.params.id, request.body.card, function(err) {
                if (err) {
                    console.log(err);
                    return response.render("someError");
                }
                response.redirect("/cards/" + request.params.id);
            });
        });
    }
    else {
        request.body.card.description = request.sanitize(request.body.card.description);
        request.body.card.description = request.body.card.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
        Card.findByIdAndUpdate(request.params.id, request.body.card, function(err) {
            if (err) {
                console.log(err);
                return response.render("someError");
            }
            response.redirect("/cards/" + request.params.id);
        });
    }
});

// DESTROY - delete existing card from database
router.delete("/:id", middleware.adminPermissions, function(request, response, next) {
    console.log("im in delete route");
    async.waterfall([
        function(done) {
            cloudDelete(request.params.id);
            done();
        },
        function(done) {
            // Delete card from db  
            Card.findByIdAndRemove(request.params.id, function(err, foundCard) {
                if (err || !foundCard) {
                    console.log(err);
                    return response.render("someError");
                }
                else {
                    done(err);
                }
            });
        }
    ], function(err) {
        if (err) return next(err);
        response.redirect("/cards");
    });
});

// safeguard against regex DDoS attack
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Delete image from cloudinary
function cloudDelete(id) {
    Card.findById(id, function(err, foundCard) {
        if (err || !foundCard) {
            console.log("Card not found. Can't delete image");
            console.log(err);
        }
        else {
            cloudinary.uploader.destroy(foundCard.image.public_id, function(err, result) {
                console.log(err);
            });
        }
    });
}

module.exports = router;
