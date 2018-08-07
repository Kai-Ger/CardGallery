Environment variables to initiate:
1.


ADMIN USER should be created as a regular user 
(/register page)
and then granted admin permissions in mongo manualy:
db.users.update({username: "yourAdminName"}, {$set: {isAdmin: "true"}})