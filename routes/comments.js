var express = require("express");
var router = express.Router({ mergeParams: true });
var Card = require("../models/card");
var Comment = require("../models/comment");
var middleware = require("../middleware");
var nodemailer = require("nodemailer");
var config = require("../config");

// CREATE - add new comment to dataBase
router.post("/", middleware.isLoggedIn, function(request, response) {
    Card.findById(request.params.id, function(err, card) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            request.body.comment.text = request.sanitize(request.body.comment.text);
            request.body.comment.text = request.body.comment.text.replace(/(?:\r\n|\r|\n)/g, '<br>');
            Comment.create(request.body.comment, function(err, comment) {
                if (err) {
                    console.log(err);
                    response.render("someError");
                }
                else {
                    // add username and id to comment
                    comment.author.id = request.user._id;
                    comment.author.username = request.user.username;
                    // save comment
                    comment.save();

                    card.comments.push(comment);
                    card.save();
                    sendNewCommentNotification(request.user, card, request.body.comment.text);
                    request.flash("info", "Your comment was added successfully");
                    response.redirect("/cards/" + card._id);
                }
            });
        }
    });
});

// EDIT - edit existing comment
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(request, response) {
    Card.findById(request.params.id, function(err, foundCard) {
        if (err || !foundCard) {
            request.flash("error", "No card found");
            return response.redirect("back");
        }
        Comment.findById(request.params.comment_id, function(err, foundComment) {
            if (err) {
                console.log(err);
                response.render("someError");
            }
            else {
                response.render("comments/edit", { card_id: request.params.id, comment: foundComment });
            }
        });
    });
});

// UPDATE - save edited comment to database
router.put("/:comment_id", middleware.checkCommentOwnership, function(request, response) {
    request.body.comment.text = request.sanitize(request.body.comment.text);
    request.body.comment.text = request.body.comment.text.replace(/(?:\r\n|\r|\n)/g, '<br>');
    Comment.findByIdAndUpdate(request.params.comment_id, request.body.comment, function(err, updatedComment) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            request.flash("info", "Your edit was saved");
            response.redirect("/cards/" + request.params.id);
        }
    });
});

// DESTROY - delete existing comment from database
router.get("/:comment_id/delete", middleware.checkCommentOwnership, function(request, response) {
    Comment.findByIdAndRemove(request.params.comment_id, function(err) {
        if (err) {
            console.log(err);
            response.render("someError");
        }
        else {
            request.flash("info", "Comment was deleted");
            response.redirect("/cards/" + request.params.id);
        }
    });
});

function sendNewCommentNotification(user, card, text) {
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
        to: config.email_to_notify,
        from: config.email_to_notify,
        subject: "User added a new comment",
        text: "User " + user.username + " has added a new comment to " + card.name + " card.\n\n" +
            "'" + text + "'",
        html: "User <strong>" + user.username + "</strong> has added a new comment to <a href=" + config.domainName + "/cards/" + card._id + ">" +
            card.name + "</a> card:<br><br> <em>" + text + "</em>",

    };
    transporter.sendMail(mailOptions, function(err) {
        if (err != null) {
            console.log("confirmation email sent to admin");
        }
        console.log(err);

    });
}


module.exports = router;
