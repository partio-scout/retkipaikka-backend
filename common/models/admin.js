//notifications field possible values are "none", "all", "some"
const { sendEmail } = require("../helpers/helpers")
// fetch users and their roles
module.exports = function (Admin) {
    const FRONTEND_URL = process.env.FRONTEND_URL;
    Admin.fetchUsers = async function (filter, req, res) {
        let wFilter = {}
        if (filter) {
            wFilter = filter.where ? filter.where : {};
        }

        let query = {
            where: wFilter,
            include: [
                {
                    relation: "roles"
                }
            ]
        }
        let admins = await Admin.find(query)
        console.log("returned " + admins.length + " admins");
        return admins;
    }

    // fetch all possible roles
    Admin.fetchAllRoles = async function (filter, req, res) {
        let wFilter = {}
        let Roles = Admin.app.models.Role;
        if (filter) {
            wFilter = filter.where ? filter.where : {};
        }

        let query = {
            where: wFilter,
        }
        let roles = await Roles.find(query)
        console.log("returned " + roles.length + " roles");
        return roles;

    }

    Admin.editUser = async function (object, req, res) {
        const { roles, user } = object;

        if (roles && user) {
            let RoleMapping = Admin.app.models.RoleMapping;
            let adminId = user.admin_id;
            if (roles) {
                if (roles.length >= 0) {
                    try {
                        await RoleMapping.destroyAll({ principalId: adminId }).then(async res => {
                            for (let i = 0; i < roles.length; ++i) {
                                let relationObject = {
                                    principalType: "USER",
                                    principalId: adminId,
                                    roleId: roles[i]
                                }
                                await RoleMapping.create(relationObject);
                            }
                        })
                    } catch (err) {
                        res.status(err.statusCode ? err.statusCode : 500)
                        return err
                    }
                }
            }
            if (Object.keys(user).length > 1) {
                if (user.new_user != null) {
                    await Admin.findById(user.admin_id).then(async res => {
                        let tempUser = JSON.parse(JSON.stringify(res));
                        if (tempUser.new_user == true && user.new_user == false) {
                            let normalUrl = `${FRONTEND_URL}/hallinta`
                            let html = `<div><h3>Rekisteröinti hyväksytty</h3><br /> Käyttäjäsi on hyväksytty retkipaikkasovellukseen.
                            <br/> Voit kirjautua sisään sovellukseen menemällä osoitteeseen ${normalUrl}</div>`
                            await sendEmail(Admin.app.models.Email, [tempUser.email], html, "Käyttäjän luonti")
                        }
                    })
                }
                await Admin.updateSettings(user)


            }
            return "success"

        }
        res.status(422);
        return "error"
    }
    Admin.updateSettings = async function (object, req, res) {
        const { admin_id } = object;
        if (object.password) delete object.password;
        let fountAdmin = await Admin.findById(admin_id);
        if (fountAdmin) {
            await fountAdmin.updateAttributes(object)
            return true;
        }
        if (res) {
            res.status(422);
        }
        return false;
    }
    Admin.on('dataSourceAttached', () => {
        const { login } = Admin;
        Admin.login = async (credentials, include) => {
            const accessToken = await login.call(Admin, credentials, include);
            let admin = await Admin.findById(accessToken.userId);
            if (admin.new_user || !admin) {
                Admin.logout(accessToken.id);
                const err = new Error('User is not activated');
                err.code = 'NOT_ACTIVE_USER';
                err.statusCode = 403;
                throw err
            }
            //let data = await Admin.fetchUserData(accessToken.userId);


            //console.log(accessToken())

            //console.log(data.regions())
            return accessToken;
        };
    });

    //notifications field possible values are "none", "all", "select"
    Admin.modifyUserNotifications = async function (object, req, res) {
        if (object.user) {
            const user = object.user;
            const regions = object.regions;
            const adminId = user.admin_id;
            let UsersRegions = Admin.app.models.UsersRegions;
            let fountAdmin = await Admin.findById(adminId);
            if (fountAdmin) {
                await fountAdmin.updateAttribute("notifications", user.notifications).then(async res => {
                    if (regions) {
                        if (regions.length >= 0) {
                            await UsersRegions.destroyAll({ admin_id: adminId }).then(async res => {
                                for (let i = 0; i < regions.length; ++i) {
                                    let relationObject = {
                                        admin_id: adminId,
                                        region_id: regions[i]
                                    }
                                    await UsersRegions.create(relationObject);
                                }
                            }).catch(err => {
                                res.status(err.statusCode ? err.statusCode : 422)
                                return err
                            })
                        }
                    }
                }).catch(err => {
                    console.error(err);
                })

                return "success"
            }
        }
        res.status(422)
        return "fail"
    }


    Admin.fetchUserData = async function (adminId, req, res) {
        let filter = {
            where: { admin_id: adminId },
            include: [{ relation: "regions" }, { relation: "roles" }]
        }
        return await Admin.findOne(filter);
    }





    // after user is registered, send email to superadmins
    const handleEmailSend = async function () {
        let emails = []
        let admins = await Admin.fetchUsers({})
        admins = JSON.parse(JSON.stringify(admins))
        admins = admins.filter(a => a.roles.find(r => r.name === "superadmin"))
        let normalUrl = `${FRONTEND_URL}/hallinta/asetukset`
        admins.forEach(a => {
            if (a.email && a.user_notifications == "all") {
                emails.push(a.email)
            }
        })
        if (emails.length !== 0) {
            let html = `<div><h3>Uusi rekisteröinti</h3><br /> Uusi käyttäjä rekisteröity retkipaikkasovellukseen 
            <br/> Voit katsoa ilmoitusta hallintasivun kautta osoitteesta ${normalUrl}</div>`
            sendEmail(Admin.app.models.Email, emails, html, "Partion retkipaikat")
        }


    }

    Admin.createUser = async function (object, req, res) {
        let tempObj = JSON.parse(JSON.stringify(object))
        tempObj.new_user = true;
        return await Admin.create(tempObj).then(async res => {
            await handleEmailSend()
            return;
        }).catch(err => {
            console.log(err);
            return err
        })

    }

    Admin.checkAccessToken = async function (token, req, res) {
        let AccessTokens = Admin.app.models.AccessToken;
        let response = await AccessTokens.exists(token)
        return response;
    }
    Admin.remoteMethod(
        'checkAccessToken', {
        http: { path: '/checkAccessToken/:token', verb: 'get' },
        accepts: [
            { arg: 'token', type: 'string', http: { source: 'path' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Check token",
        returns: { type: String, root: true }
    });

    Admin.remoteMethod(
        'createUser', {
        http: { path: '/createUser', verb: 'post' },
        accepts: [
            { arg: 'userData', type: 'object', http: { source: 'body' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Add a new user",
        returns: { type: String, root: true }
    });

    Admin.remoteMethod(
        'editUser', {
        http: { path: '/editUser', verb: 'patch' },
        accepts: [
            { arg: 'user', type: 'object', http: { source: 'body' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Edit user's roles and activation status",
        returns: { type: String, root: true }
    });
    Admin.remoteMethod(
        'updateSettings', {
        http: { path: '/updateSettings', verb: 'patch' },
        accepts: [
            { arg: 'user', type: 'object', http: { source: 'body' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Edit user's properties ",
        returns: { type: String, root: true }
    });


    Admin.remoteMethod(
        'modifyUserNotifications', {
        http: { path: '/modifyUserNotifications', verb: 'patch' },
        accepts: [
            { arg: 'user', type: 'object', http: { source: 'body' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Modifies notification settings of single user",
        returns: { type: String, root: true }
    });
    Admin.remoteMethod(
        'fetchUserData', {
        http: { path: '/fetchUserData/:adminId', verb: 'get' },
        accepts: [
            { arg: 'adminId', type: 'string', http: { source: 'path' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Fetch single user",
        returns: { type: Admin, root: true }
    });

    Admin.remoteMethod(
        'fetchUsers', {
        http: { path: '/fetchUsers', verb: 'get' },
        accepts: [
            { arg: 'filter', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Return admin users with their roles",
        returns: { type: Admin, root: true }
    }
    );
    Admin.remoteMethod(
        'fetchAllRoles', {
        http: { path: '/fetchAllRoles', verb: 'get' },
        accepts: [
            { arg: 'filter', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Return all current roles",
        returns: { type: Object, root: true }
    }
    );
}
