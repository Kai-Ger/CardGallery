var express = require("express");
var router = express.Router();
var Card = require("../models/card");
var User = require("../models/user");
var middleware = require("../middleware");
var multer = require("multer");
var mongoose = require("mongoose");
var async = require("async");
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

// safeguard against regex DDoS attack
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}


// LIST OF USERS
router.get("/", middleware.adminPermissions, function(request, response) {
    User.find({}, function(err, users) {
        if (err) {
            console.log(err);
        }
        else {
            response.render("users/users-index", { users: users });
        }
    });
});

// USER PROFILE
router.get("/:id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        User.findById(request.params.id).populate("wishes").exec(function(err, foundUser) {
            if (err) {
                console.log(err);
                request.flash("error", "User not found");
                response.redirect("/users");
            }
            else {
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
                request.flash("error", "User not found");
                console.log(err);
                return response.redirect("back");
            }
            response.render("users/user-edit", { user: foundUser });
        });
    }
});

// UPDATE USER
router.put("/:id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        User.findByIdAndUpdate(request.params.id, request.body.user, function(err) {
            if (err) {
                request.flash("error", "Something went wrong while updating user profile");
                response.redirect("back");
            }
            else {
                request.flash("info", "User profile edit was saved");
                response.redirect("/users/" + request.params.id);
            }
        });
    }
});

// DELETE card from wishlist
router.delete("/:id/wishes/:card_id", function(request, response) {
    if (request.user._id.equals(request.params.id) || request.user.isAdmin) {
        var cardID = mongoose.mongo.ObjectID(request.params.card_id);
        User.findByIdAndUpdate(request.params.id, { $pull: { "wishes": cardID } }, function(err, user) {
            if (err) {
                console.log(err);
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

// DELETE USER
router.delete("/:id", middleware.adminPermissions, function(request, response) {
    User.findByIdAndRemove(request.params.id, function(err) {
        if (err) {
            console.log(err);
            request.flash("error", "Something went wrong when deleting user");
            response.redirect("back");
        }
        else {
            request.flash("info", "User was deleted");
            response.redirect("/users");
        }
    });
});





module.exports = router;
