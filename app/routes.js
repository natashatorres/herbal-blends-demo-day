// const { default: Stripe } = require("stripe");
// require('dotenv').config()

module.exports = function (app, passport, db, ObjectId, stripe, fetch) {

  // home page ===================================================================
  app.get('/', (req, res) => {

    db.collection('herbs').find().toArray((err, result) => {
      if (err) return console.log(err)
      const base = result.filter(h => h.component === "Base")
      const flavor = result.filter(h => h.component === "Flavor")
      const support = result.filter(h => h.component === "Support")
      const liked = result.filter(h => h.component === 0)
      res.render('index.ejs', {
        base: base, flavor: flavor, support: support, liked: liked
      })
    })
  })

  // about ===============================================================
  app.get('/about', function (req, res) {
   
    res.render('about.ejs');
  });
  
  app.get('/cart', isLoggedIn, (req, res) => {
    db.collection('cart').find({ userId: ObjectId(req.user._id) }).toArray((err, result) => {

      if (err) return console.log(err)
      res.render('cart.ejs', { cart: result })
    })
  })

  app.get('/confirmation', function (req, res) {
    req.logout();
    res.render('confirmation.ejs');
  });

  //stripe confirmation pages
  app.get('/success', function (req, res) {
    db.collection('cart').find({ userId: ObjectId(req.user._id) }).toArray(async (err, result) => {
      console.log(result)
      const total = result.reduce((a,b) => a.price + b.price)
      console.log(total)
      let html = "Reciept from Herbal Blends " + result.map(item => `${item.base}, ${item.flavor}, ${item.support} Pre-Roll X ${item.qty} ${item.price}.00`) + ` Amount Charged: $${total}.00` + " If you have any questions, contact us at herbal-blends@gmail.com."
      sendMail(req.user.local.email, "Your Herbal Blends receipt", html)
      res.render('success.ejs');
    });
  });

  app.get('/cancel', function (req, res) {
    req.logout();
    res.render('cancel.ejs');
  });

  // PLANT SECTION ==================================
  app.get('/plant', function (req, res) {
    const plantName = req.query.plantname
    fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${plantName}&prop=text&section=0&format=json`)
      .then(response => {
        if (response.ok) return response.json()
      })
      .then(data => {
        console.log(data)
        res.render('plant.ejs', {
          plantName, data
        });
      })
  });

// IDENTIFY PLANT ==============================

app.get('/identify', function (req, res) {

  res.render('identify.ejs');
});
//pure api looks through data base 
app.get('/findPlant/:scientificName', function (req, res) {
  let scientificName = req.params.scientificName
  console.log(scientificName)
  db.collection('herbs').findOne({alternateNames : {$in : [scientificName]}},(err, result) => {
    if (err) return console.log(err)
    console.log(result)
    res.send(result)
  })
});


// app.get('/handlePlantsId', function (req, res) {
//   let plantName = req.query.plant

//   console.log(plantName)
//   //scientific names
//   //find text in an array create a filter for scientifc name 
//   res.render('handlePlantsId.ejs', {plantName, data});
// });

  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, function (req, res) {
    db.collection('messages').find().toArray((err, result) => {
      if (err) return console.log(err)
      res.render('profile.ejs', {
        user: req.user,
        messages: result
      })
    })
  });

  // LOGOUT ==============================
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  // cart routes ===============================================================

  app.post('/cart', isLoggedIn, (req, res) => {
    //created a new document that went into messages collection
    console.log(req.body)
    db.collection('cart').insertOne({
      _id: req.body.id,
      base: req.body.base,
      flavor: req.body.flavor,
      support: req.body.support,
      price: 10,
      qty: 1,
      userId: req.user._id
    }, (err, result) => {
      if (err) return console.log(err)
      console.log('saved to database')
      res.redirect('/cart') /// create a get cart page
    })
  })

  app.put('/cart', (req, res) => {
    db.collection('cart')
      .findOneAndUpdate({
        _id: ObjectId(req.body.id),
      }, {
        $inc: {
          qty: req.body.qty
        }
      }, {
        sort: { _id: -1 },
        upsert: false
      }, (err, result) => {
        if (err) return res.send(err)
        res.send(result)
      })
  })

  app.delete('/cart', (req, res) => {
    console.log(req.body.id, req.body.id === "616e19334e665fc02b002cbc", typeof req.body.id)
    db.collection('cart').findOneAndDelete({
      _id: ObjectId(req.body.id)
    }, (err, result) => {
      if (err) return res.send(500, err)
      res.send('Message deleted!')
    })
  })

  // checkout board routes ===============================================================
  app.post('/create-checkout-session', async (req, res) => {
    db.collection('cart').find({ userId: ObjectId(req.user._id) }).toArray(async (err, result) => {

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          /*insert HERE items or order or whatever is holding the data*/
          line_items: result.map(item => {
            //change this
            return {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${item.base} ${item.flavor} ${item.support}`
                },
                unit_amount: item.price * 100
              },
              quantity: item.qty,
            }
          }),
          success_url: `${process.env.SERVER_URL}success`,
          cancel_url: `${process.env.SERVER_URL}/cancel`,
        })
        res.json({ url: session.url })
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })
  })


  //CONFIRMATION EMAIL =============================

  const nodemailer = require("nodemailer");
  const { google, containeranalysis_v1alpha1 } = require("googleapis");
  const OAuth2 = google.auth.OAuth2;
  const oauth2Client = new OAuth2(
    "343026941432-iotq79r25quk8kfjbrghoqqr16rpmetr.apps.googleusercontent.com", //ClientID
    "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", // Client Secret
    "https://developers.google.com/oauthplayground" // Redirect URL
  );

  function sendMail(toEmail, subject, html) {
    oauth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN
    });
    const accessToken = oauth2Client.getAccessToken()
    console.log(process.env.EMAIL, process.env.CLIENT_SECRET, process.env.REFRESH_TOKEN)
    const smtpTransport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL,
        clientId: "343026941432-iotq79r25quk8kfjbrghoqqr16rpmetr.apps.googleusercontent.com", //ClientID
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: toEmail,
      subject: subject,
      generateTextFromHTML: true,
      html: html,
    };

    smtpTransport.sendMail(mailOptions, (error, response) => {
      error ? console.log(error) : console.log(response);
      smtpTransport.close();
    });
  }

  // =============================================================================
  // AUTHENTICATE (FIRST LOGIN) ==================================================
  // =============================================================================

  // locally --------------------------------
  // LOGIN ===============================
  // show the login form
  app.get('/login', function (req, res) {
    res.render('login.ejs', { message: req.flash('loginMessage') });
  });

  // process the login form
  app.post('/login', passport.authenticate('local-login', {
    successRedirect: '/', // redirect to the secure profile section
    failureRedirect: '/login', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // SIGNUP =================================
  // show the signup form
  app.get('/signup', function (req, res) {
    res.render('signup.ejs', { message: req.flash('signupMessage') });
  });

  // process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/', // redirect to the secure profile section
    failureRedirect: '/signup', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // =============================================================================
  // UNLINK ACCOUNTS =============================================================
  // =============================================================================
  // used to unlink accounts. for social accounts, just remove the token
  // for local account, remove email and password
  // user account will stay active in case they want to reconnect in the future

  // local -----------------------------------
  app.get('/unlink/local', isLoggedIn, function (req, res) {
    var user = req.user;
    user.local.email = undefined;
    user.local.password = undefined;
    user.save(function (err) {
      res.redirect('/profile');
    });
  });

};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    console.log("isAuthenticated true")
    return next();
  }
  console.log("isAuthenticated false")

  res.redirect('/login');
}

