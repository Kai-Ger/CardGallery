1. For sensitive data please create in project root folder
config.js
2. Add config.js to .gitignore
3. config.js should include:

------------------------------------------
var config = {
    "email_pass": "",
    "email_to_notify": "",
    "passport_secret": "",
    "cloudinary_cloud_name": "",
    "cloudinary_api_key": "",
    "cloudinary_api_secret": "",
    "mongoDBurl": ""

};

module.exports = config;
------------------------------------------

4. ADMIN USER should be created as a regular user 
(/register page)
and then granted admin permissions in mongo manualy:
db.users.update({username: "yourAdminName"}, {$set: {isAdmin: "true"}})