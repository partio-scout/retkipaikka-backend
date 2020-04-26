'use strict';
module.exports = function (app) {

    let checkIfExists = function (model, filter) {
        return model.find(filter).then(res => {
            return res.length;
        }).catch(err => {
            console.error(err);
        });
    }
    // generate admin user if it's not already created
    let handleUserCreation = async function () {
        var User = app.models.Admin;
        var Role = app.models.Role;
        var RoleMapping = app.models.RoleMapping;
        let email = process.env.LB_EMAIL || "hallinta@retkipaikka.com";
        let password = process.env.LB_PASSWORD || "demo";
        let userExists = await checkIfExists(User, { where: { email: email } });
        let roleExists = await checkIfExists(Role, { where: { name: "superadmin" } });
        if (userExists === 0) {
            User.create({ new_user: false, username: 'Superadmin', email: email, password: password }, function (err, users) {
                if (err) console.error(err);
                console.log("Created Superadmin user")
                if (roleExists === 0) {
                    // Create the admin role
                    Role.create({ name: 'superadmin' }, function (err, role) {
                        if (err) console.error(err);
                        role.principals.create({ principalType: RoleMapping.USER, principalId: users.id }, function (err, principal) {
                            if (err) console.error(err);
                        });
                    });
                }
            });
        }

    }

    handleUserCreation()
};