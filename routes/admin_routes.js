var express = require("express");
var router = express.Router();
var Card = require("../models/card");
var User = require("../models/user");
var multer = require("multer");
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

// NEW - show the form to create a new card
router.get("/new", adminPermissions, function(request, response) {
    response.render("cards/new");
});

// CREATE - add new card to dataBase
router.post("/", adminPermissions, upload.single("image"), function(request, response) {

    cloudinary.uploader.upload(request.file.path, function(result) {
        // add cloudinary image url to the card object
        request.body.card.image = {
            url: result.secure_url,
            public_id: result.public_id
        };
        // add new card object to database
        Card.create(request.body.card, function(err, newlyCreated) {
            if (err) {
                request.flash("error", "Something went wrong. Please try again");
                console.log(err);
                return response.redirect("back");
            }
            response.redirect("/cards/" + newlyCreated.id);
        });
    });
    console.log(request.body.image);
});

// EDIT - edit existing card
router.get("/:id/edit", adminPermissions, function(request, response) {
    Card.findById(request.params.id, function(err, foundCard) {
        response.render("cards/edit", { card: foundCard });

    });
});

// UPDATE - save edited card to database
router.put("/:id", adminPermissions, upload.single("image"), function(request, response) {
    if (request.file) {
        // delete image from cloud
        cloudDelete(request.params.id);
        cloudinary.uploader.upload(request.file.path, function(result) {
            // add cloudinary image url to the card object
            request.body.card.image = {
                url: result.secure_url,
                public_id: result.public_id
            };
            Card.findByIdAndUpdate(request.params.id, request.body.card, function(err) {
                response.redirect("/cards/" + request.params.id);
            });
        });
    }
    else {
        Card.findByIdAndUpdate(request.params.id, request.body.card, function(err) {
            response.redirect("/cards/" + request.params.id);
        });
    }
});

// DESTROY - delete existing card from database
router.delete("/:id", adminPermissions, function(request, response, next) {
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

// Confirm that user has admin permissions (middleware)
function adminPermissions(request, response, next) {
    if (request.isAuthenticated()) {
        if (request.user.isAdmin) {
            next();
        }
        else {
            request.flash("error", "You need to have Admin permissions in order to proceed");
            response.redirect("back");
        }
    }
}

// Delete image from cloudinary
function cloudDelete(id) {
    Card.findById(id, function(err, foundCard) {
        if (err || !foundCard) {
            console.log("Card not found");
        }
        else {
            cloudinary.uploader.destroy(foundCard.image.public_id, function(err, result) {
                console.log(err);
            });
        }
    });
}

module.exports = router;
