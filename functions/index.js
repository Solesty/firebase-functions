const functions = require('firebase-functions');
const admin = require("firebase-admin")
admin.initializeApp()

// auth trigger (new user signup)
exports.newUserSignup = functions.auth.user().onCreate(user => {
    // for background triggers you must return a value/promise

    // create a new users collection document, can not be stored in the auth's user object
    return admin.firestore().collection("requests-users").doc(user.uid).set({
        email: user.email,
        upvotedOn: []
    });
})

// auth trigger (user deleted)
exports.userDeleted = functions.auth.user().onDelete(user => {
    // for background triggers you must return a value/promise

    const document = admin.firestore().collection("requests-users").doc(user.uid)
    return document.delete()
})

// http callable function (adding a request)
exports.addRequest = functions.https.onCall((data, context) => {
    if (!context.auth) {
        // user is not logged in
        throw new functions.https.HttpsError(
            'unauthenticated',  // one of many selection
            'Only authenticated users can add requests.',
        )
    }

    if (data.text.length > 30) {
        throw new functions.https.HttpsError(
            'invalid-argument',  // one of many selection
            'Request must not be more than 30 characters long.',
        )
    }

    return admin.firestore().collection("requests").add({
        text: data.text,
        upvotes: 0
    })
})

// upvote callable function
exports.upvote = functions.https.onCall(async (data, context) => {
    // data.id is the request the user wants to upvote

    // check auth state
    if (!context.auth) {
        // user is not logged in
        throw new functions.https.HttpsError(
            'unauthenticated',  // one of many selection
            'Only authenticated users can vote.',
        )
    }

    // get refs for  user doc and request doc
    const requestUser = admin.firestore().collection('requests-users').doc(context.auth.uid)
    // get the request document the users wants to upvote
    const request = admin.firestore().collection("requests").doc(data.id)

    const doc = await requestUser.get()

    // doc is the request document the user wants to upvote

    // check if the user hasn't already upvoted the request
    if (doc.data().upvotedOn.includes(data.id)) {
        throw new functions.https.HttpsError(
            'failed-precondition',  // one of many selection
            'You can only upvote something once',
        )
    }


    // update the request user array
    // the list of requests they have upvoted on
    await requestUser.update({
        upvotedOn: [...doc.data().upvotedOn, data.id]
    })

    // update votes on the request,
    // increment by 1
    return request.update({
        upvotes: admin.firestore.FieldValue.increment(1)
    })

})


// firestore trigger for tracking activity
exports.logActivities = functions.firestore.document('/{collection}/{id}')
    .onCreate((snap, context) => {
        // snapshot of the document being created
        console.log(snap.data())

        const collection = context.params.collection
        const id = context.params.id

        const activities = admin.firestore().collection("activities")

        if (collection === 'requests') {
            // this is the requests collection
            return activities.add({ text: 'a new tutorial request was added' })
        }

        if (collection === 'requests-users') {
            // this is the requests collection
            return activities.add({ text: 'a new user signed up' })
        }

        return null
    })