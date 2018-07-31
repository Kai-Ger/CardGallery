var express = require("express");
var router = express.Router({ mergeParams: true });
var Card = require("../models/card");
var Comment = require("../models/comment");
var middleware = require("../middleware");

// NEW - show the form to create a new comment
router.get("/new", middleware.isLoggedIn, function(request, response) {
    Card.findById(request.params.id,
        function(err, card) {
            if (err) {
                console.log(err);
            }
            else {
                response.render("comments/new", { card: card });
            }
        });
});

// CREATE - add new comment to dataBase
router.post("/", middleware.isLoggedIn, function(request, response) {
    Card.findById(request.params.id,
        function(err, card) {
            if (err) {
                console.log(err);
            }
            else {
                Comment.create(request.body.comment, function(err, comment) {
                    if (err) {
                        request.flash("error", "Something went wrong");
                    }
                    else {
                        // add username and id to comment
                        comment.author.id = request.user._id;
                        comment.author.username = request.user.username;
                        // save comment
                        comment.save();

                        card.comments.push(comment);
                        card.save();
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
                request.flash("error", "Something went wrong");
                response.redirect("back");
            }
            else {
                response.render("comments/edit", { card_id: request.params.id, comment: foundComment });
            }
        });
    });
});

// UPDATE - save edited comment to database
router.put("/:comment_id", middleware.checkCommentOwnership, function(request, response) {
    Comment.findByIdAndUpdate(request.params.comment_id, request.body.comment, function(err, updatedComment) {
        if (err) {
            request.flash("error", "Something went wrong");
            response.redirect("back");
        }
        else {
            request.flash("info", "Your edit was saved");
            response.redirect("/cards/" + request.params.id);
        }
    });
});

// DESTROY - delete existing comment from database
router.delete("/:comment_id", middleware.checkCommentOwnership, function(request, response) {
    Comment.findByIdAndRemove(request.params.comment_id, function(err) {
        if (err) {
            request.flash("error", "Something went wrong");
            response.redirect("back");
        }
        else {
            request.flash("info", "Comment was deleted");
            response.redirect("/cards/" + request.params.id);
        }
    });
});


module.exports = router;
