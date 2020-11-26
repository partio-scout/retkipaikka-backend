

const sendEmail = async function (EmailModel, emails, html, subject, from) {

    //let html = `<div><h5>${title}</h5><br /> ${text}</div>`
    for (const email of emails) {
        await EmailModel.send({
            to: email,
            from: from,
            subject: subject,
            html: html
        }, function (err) {
            if (err) {
                console.log(err);
                console.log('> error sending an email');
                return
            }
            console.log('> email sent to:', email);
        });
    }

    return;
}

exports.sendEmail = sendEmail;