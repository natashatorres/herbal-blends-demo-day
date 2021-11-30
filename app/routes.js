
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

  // about ===============================================================
  app.get('/about', function (req, res) {
    res.render('about.ejs');
  });

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
      res.render('cart.ejs', { cart: result })
    })
  })

  app.get('/confirmation', function (req, res) {
    req.logout();
    res.render('confirmation.ejs');
  });

  // cart routes ===============================================================

  app.post('/cart', isLoggedIn, (req, res) => {
    //created a new document that went into messages collection
    console.log(req.body)
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
      res.redirect('/cart') /// create a get cart page
    })
  })

  app.post('/allHerbsCart', isLoggedIn, (req, res) => {
    //created a new document that went into messages collection
    console.log(req.body)
    db.collection('cart').insertOne({
      _id: req.body.id,
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
          console.log("result here", cartItems)
          const total = cartItems.reduce((a, b) => a.price + b.price)
          console.log(total)
          let html = "Reciept from Herbal Blends " + cartItems.map(item => `${item.base}, ${item.flavor}, ${item.support} Pre-Roll X ${item.qty} ${item.price}.00`) + ` Amount Charged: $${total}.00` + " If you have any questions, contact us at herbal-blends@gmail.com."
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
  //pure api looks through data base 
  app.get('/findPlant/:scientificName', function (req, res) {
    let scientificName = req.params.scientificName
    console.log(scientificName)
    db.collection('herbs').findOne({ alternateNames: { $in: [scientificName] } }, (err, result) => {
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
    db.collection('cart').find({ userId: req.user._id, completed: true }).toArray((err, result) => {
      if (err) return console.log(err)

      const groups = result.reduce((groups, order) => {
        console.log(order)
        const date = order.orderDate.toString().split('T')[0];
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(order);
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

      console.log(groups, groupArrays)

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

  // app.post('/imageUpload', upload.single('image'), (req, res, next) => {
  //   console.log('starting image upload')
  //   const obj = {
  //     name: req.body.name,
  //     desc: req.body.desc,
  //     img: {
  //       data: '/public/uploads/' + req.file.filename,
  //       contentType: 'image/png'
  //     }
  //   }
  //   console.log(obj)
  //   userSchema.findOneAndUpdate({
  //     _id: req.user._id,
  //   },
  //     obj, (err, item) => {
  //       if (err) {
  //         console.log(err);
  //       }
  //       else {
  //         console.log('Saved image to database')
  //         res.redirect('/profile');
  //       }
  //     });
  // });

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

