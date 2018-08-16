var express = require("express");
var router = express.Router();
var Card = require("../models/card");
var User = require("../models/user");
var middleware = require("../middleware");
var nodemailer = require("nodemailer");
var multer = require("multer");
var mongoose = require("mongoose");
var async = require("async");

var config = require("../config");


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
    if (request.user._id.equals(request.params.id) && request.user.active || request.user.isAdmin) {
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
    else {
        if (!request.user.active) {
            request.flash("error", "User should complete email confirmation order to proceed");
            response.redirect("back");
        }
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
        if (request.body.introduction) {
            request.body.user.introduction = request.sanitize(request.body.user.introduction);
            request.body.user.introduction = request.body.user.introduction.replace(/(?:\r\n|\r|\n)/g, '<br>');
        }
        request.body.user.username = request.body.user.username.toLowerCase();
        User.findByIdAndUpdate(request.params.id, request.body.user, function(err) {
            if (err) {
                if (err.message.includes("E11000")) {
                    return response.render("register", { "error": "This Email has already been registered" });
                }
                else {
                    return response.render("register", { "error": err.message });
                }
            }
            else {
                request.flash("info", "User profile edit was saved");
                response.redirect("/logout");
            }
        });
    }
});

// Confirm sending the card to user and remove this card from wishlist
router.post("/:id/sent/:card_id", middleware.adminPermissions, function(request, response) {
    async.waterfall([
        function(callback) {
            // Check that card is not out of stock
            Card.findById(request.params.card_id, function(err, card) {
                if (card.amount < 1) {
                    request.flash("error", "The card is out of stock");
                    callback("out of stock");
                }
                else {
                    callback(err);
                }
            });
        },
        function(callback) {
            // Reduce amount of cards in stock
            Card.findByIdAndUpdate(request.params.card_id, { $inc: { amount: -1 } }, function(err, card) {
                console.log(err);
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
                        user: config.email_to_notify,
                        pass: config.email_pass
                    }
                });
                var mailOptions = {
                    to: user.email,
                    from: config.email_to_notify,
                    subject: "Your wish came true",
                    text: "Dear " + user.username + "\n\n" + "The card you wished for\n" + card.name + "\n" + "is on its way to you.",
                    html: "Dear " + user.username + "<br><br>" + "The card you wished for<br>" +
                        "<a href=" + config.domainName + "/cards/" + card._id + ">" + card.name + "</a><br>is on its way to you.",
                };
                transporter.sendMail(mailOptions, function(err) {
                    if (!err) {
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
                        var sent = { sentDate: new Date(), sentCardName: card.name, pCard: card };
                        user.sentCards.push(sent);
                        user.sentCardsCount = user.sentCardsCount + 1;
                        user.save();
                    }
                    callback(err);
                });
            }
        },
    ], function(err) {
        if (err === "out of stock") {
            console.log(err);
            response.redirect('back');
        }
        else {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                response.redirect("/users/" + request.params.id);
            }
        }
    });
});

// DELETE card from wishlist
router.get("/:id/wishes/:card_id/delete", function(request, response) {
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
router.get("/:id/sentCard/:card_id/delete", function(request, response) {
    if (request.user.isAdmin) {
        var cardID = mongoose.mongo.ObjectID(request.params.card_id);
        User.findByIdAndUpdate(request.params.id, { $pull: { "sentCards": { "_id": cardID } } }, { 'new': true }, function(err, user) {
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
router.get("/:id/delete", middleware.adminPermissions, function(request, response) {
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

// ACTIVATE User Account
router.get("/:id/active", middleware.adminPermissions, function(request, response) {
    User.findByIdAndUpdate(request.params.id, { $set: { "active": "true" } }, function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            request.flash("info", "User Account has been activated");
            response.redirect("/users/" + request.params.id);
        }
    });
});


module.exports = router;
