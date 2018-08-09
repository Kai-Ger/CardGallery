var express = require("express");
var router = express.Router();
var Card = require("../models/card");
var User = require("../models/user");
var middleware = require("../middleware");
var nodemailer = require("nodemailer");
var multer = require("multer");
var mongoose = require("mongoose");
var async = require("async");


// safeguard against regex DDoS attack
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}


// LIST OF USERS
router.get("/", middleware.adminPermissions, function(request, response) {
    User.find({}, function(err, users) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            response.render("users/users-index", { users: users, page: 'users' });
        }
    });
});

// USER PROFILE
router.get("/:id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        User.findById(request.params.id).populate("wishes").populate("sentCards.pCard").exec(function(err, foundUser) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                console.log(foundUser);
                response.render("users/user-profile", { user: foundUser });
            }
        });
    }
});

// EDIT USER
router.get("/:id/edit", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        User.findById(request.params.id, function(err, foundUser) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            response.render("users/user-edit", { user: foundUser });
        });
    }
});

// UPDATE USER
router.put("/:id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        console.log(request.body.introduction);
        request.body.user.introduction = request.sanitize(request.body.user.introduction);
        request.body.user.introduction = request.body.user.introduction.replace(/(?:\r\n|\r|\n)/g, '<br>');
        console.log(request.body.introduction);
        User.findByIdAndUpdate(request.params.id, request.body.user, function(err) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                request.flash("info", "User profile edit was saved");
                response.redirect("/users/" + request.params.id);
            }
        });
    }
});

// Confirm sending the card to user and remove this card from wishlist
router.post("/:id/sent/:card_id", middleware.adminPermissions, function(request, response) {
    async.waterfall([
        function(callback) {
            // Reduce amount of cards in stock
            Card.findByIdAndUpdate(request.params.card_id, { $inc: { amount: -1 } }, function(err, card) {
                console.log(err);
                console.log("request.params.card_id " + request.params.card_id);
                console.log("Amount of cards was reduced for " + card.name);
                callback(err, card);
            });
        },
        function(card, callback) {
            // Send confirmation email to the user
            User.findById(request.params.id, function(err, user) {
                var transporter = nodemailer.createTransport({
                    service: "Gmail",
                    host: 'smtp.gmail.com',
                    auth: {
                        type: "login", // default
                        user: "yuuyuuuki@gmail.com",
                        pass: "yukonpass123"
                        //  pass: process.env.GMAILPW
                    }
                });
                var mailOptions = {
                    to: user.email,
                    from: "yuuyuuuki@gmail.com",
                    subject: "Your wish came true",
                    text: "Dear " + user.username + "\n\n" +
                        "The card you wished for\n" +
                        card.name + "\n" +
                        "is on its way to you."
                };
                transporter.sendMail(mailOptions, function(err) {
                    if (err != null) {
                        console.log("confirmation email sent");
                        request.flash("success", "Confirmation email was sent to user " + user.email);
                    }
                });
                callback(err, card, user);
            });
        },
        function(card, user, callback) {
            // Remove this card from wishlist and Add to Sent list
            if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
                User.findByIdAndUpdate(user._id, { $pull: { "wishes": card._id } }, function(err, user) {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        user.wishesCount = user.wishesCount - 1;
                        var sent = { sentDate: new Date(), pCard: card };
                        user.sentCards.push(sent);
                        user.sentCardsCount = user.sentCardsCount + 1;
                        user.save();
                    }
                    callback(err);
                });
            }
        },
    ], function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            response.redirect("/users/" + request.params.id);
        }
    });
});

// DELETE card from wishlist
router.delete("/:id/wishes/:card_id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        var cardID = mongoose.mongo.ObjectID(request.params.card_id);
        User.findByIdAndUpdate(request.params.id, { $pull: { "wishes": cardID } }, function(err, user) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                user.wishesCount = user.wishesCount - 1;
                user.save();
                request.flash("info", "Your wish was removed successfully");
                response.redirect("/users/" + request.params.id);
            }
        });
    }
});

// DELETE card from Sent cards section
router.delete("/:id/sentCard/:card_id", function(request, response) {
    if (request.user.isAdmin) {
        var cardID = mongoose.mongo.ObjectID(request.params.card_id);
        User.findByIdAndUpdate(request.params.id, { $pull: { "sentCards": { "pCard": cardID } } }, { 'new': true }, function(err, user) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                user.sentCardsCount = user.sentCardsCount - 1;
                user.save();
                request.flash("info", "Sent card record was removed successfully");
                response.redirect("/users/" + request.params.id);
            }
        });
    }
});

// DELETE USER
router.delete("/:id", middleware.adminPermissions, function(request, response) {
    User.findByIdAndRemove(request.params.id, function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            request.flash("info", "User was deleted");
            response.redirect("/users");
        }
    });
});

module.exports = router;
