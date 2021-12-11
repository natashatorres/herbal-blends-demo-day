
module.exports = function (app, passport, db, ObjectId, stripe, fetch, multer, fs) {

  //MULTER =======================================================================
  const userSchema = require('./models/user')
  const path = require('path');

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads')
    },
    filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + ".png")
    }
  });

  let upload = multer({ storage: storage });


  // home page ===================================================================
  app.get('/', (req, res) => {
    res.render('index.ejs');
  })


  //store  ===============================================================
  app.get('/store', function (req, res) {
    db.collection('herbs').find().toArray((err, result) => {
      if (err) return console.log(err)
      db.collection('specialblends').find().toArray((err, specBlendsResult) => {
        if (err) return console.log(err)
        res.render('store.ejs', {
          specialblends: specBlendsResult,
          herbs: result,
          user: req.user
        })
      })
    })
  });

  //customize  ===============================================================
  app.get('/customize', function (req, res) {
    db.collection('herbs').find().toArray((err, result) => {
      if (err) return console.log(err)
      const base = result.filter(h => h.component === "Base")
      const flavor = result.filter(h => h.component === "Flavor")
      const support = result.filter(h => h.component === "Support")
      const liked = result.filter(h => h.component === 0)
      res.render('customize.ejs', {
        base: base,
        flavor: flavor,
        support: support,
        liked: liked,
        user: req.user
      })
    })
  });

  // cart ================================================================
  app.get('/cart', isLoggedIn, (req, res) => {
    db.collection('cart').find({ userId: ObjectId(req.user._id), completed: false }).toArray((err, result) => {
      if (err) return console.log(err)
      let total = 0
      for (let i = 0; i < result.length; i++) {
        total += result[i].price
      }
      res.render('cart.ejs', { cart: result, total: total })
    })
  })


  app.post('/cart', isLoggedIn, (req, res) => {
    //created a new document that went into messages collection
    db.collection('cart').insertOne({
      _id: req.body.id,
      name: req.body.name,
      base: req.body.base,
      flavor: req.body.flavor,
      support: req.body.support,
      price: 10,
      qty: 1,
      userId: req.user._id,
      completed: false
    }, (err, result) => {
      if (err) return console.log(err)
      console.log('saved to database')
      res.redirect('/store') /// create a get cart page
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

  //stripe confirmation pages ==============================================

  app.get('/success', function (req, res) {
    db.collection('cart').find({ userId: ObjectId(req.user._id), completed: false }).toArray(async (err, cartItems) => {
      db.collection('cart').updateMany({ $and: [{ userId: ObjectId(req.user._id) }, { completed: false }] }, {
        $set: { completed: true, orderDate: new Date() }
      },
        async (err, updateResult) => {
          const total = cartItems.reduce((a, b) => a += b.price, 0)
          function makeName(item) {
            let itemName = item.name
            if (!itemName) {
              itemName = `${item.base} | ${item.flavor} | ${item.support} Blend`
            }
            return itemName
          }
          let html = "Reciept from Herbal Blends " + cartItems.map(item => `      * ${makeName(item)} QTY: ${item.qty} ${item.price}.00\n\n`) + `Amount Charged: $${total}.00` + " If you have any questions, contact us at herbal-blends@gmail.com."
          sendMail(req.user.local.email, "Your Herbal Blends receipt", html)
          res.render('success.ejs');
        });
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

  //PURE API LOOKS THROUGH DATABASE
  app.get('/findPlant/:scientificName', function (req, res) {
    let scientificName = req.params.scientificName
    db.collection('herbs').findOne({ alternateNames: { $in: [scientificName] } }, (err, result) => {
      if (err) return console.log(err)
      console.log(result)
      res.send(result)
    })
  });


  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, function (req, res) {
    db.collection('cart').find({ userId: req.user._id, completed: true }).toArray((err, result) => {
      if (err) return console.log(err)

      const groups = result.reduce((groups, order) => {
        const date = (order.orderDate.getMonth() + 1) + "-" + order.orderDate.getDate() + "-" + order.orderDate.getFullYear() + order.orderDate.getHours() + order.orderDate.getMinutes()
        const shortDate = (order.orderDate.getMonth() + 1) + "-" + order.orderDate.getDate() + "-" + order.orderDate.getFullYear()
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(order);
        order.shortDate = shortDate
        return groups;
      }, {});

      const groupArrays = Object.keys(groups).map((date) => {
        return {
          date,
          orders: groups[date],
          priceTotal: groups[date].reduce((acc, order) => acc += order.price, 0),
          qty: groups[date].length
        };
      });


      res.render('profile.ejs', {
        user: req.user,
        pastOrders: groupArrays,
      })
    })
  });

  //MULTER ==========================================
  app.post('/imageUpload', upload.single('file-to-upload'), (req, res, next) => {
    insertDocuments(db, req, '/uploads/' + req.file.filename, () => {
      res.redirect('/profile')
    });
  });

  var insertDocuments = function (db, req, filePath, callback) {
    var collection = db.collection('users');
    var uId = ObjectId(req.session.passport.user)
    collection.findOneAndUpdate({
      "_id": uId
    }, {
      $set: {
        "local.img": filePath
      }
    }, {
      sort: {
        _id: -1
      },
      upsert: false
    }, (err, result) => {
      if (err) return res.send(err)
      callback(result)
    })
  }

  app.post('/userInfo', (req, res) => {
    db.collection('userInfo').save({
      name: req.body.name, 
      email: req.body.email,
      phone: req.body.phone,
      website: req.body.website,
      street: req.body.street,
      city: req.body.city,
      state: req.body.state,
      zipcode: req.body.zipcode
    }, (err, result) => {
      if (err) return console.log(err)
      console.log('saved to database')
      res.redirect('/profile')
    })
  })

  // LOGOUT ==============================
  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  // checkout board routes ===============================================================
  app.post('/create-checkout-session', async (req, res) => {
    db.collection('cart').find({ userId: ObjectId(req.user._id), completed: false }).toArray(async (err, result) => {

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
                  name: item.name ? item.name : item.base + " " + item.flavor + " " + item.support + "Blend"
                },
                unit_amount: item.price * 100
              },
              quantity: item.qty,
            }
          }),
          success_url: `${process.env.SERVER_URL}/success`,
          cancel_url: `${process.env.SERVER_URL}/cancel`,
        })
        res.json({ url: session.url })
      } catch (e) {
        console.log(e)
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

