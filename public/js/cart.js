const checkout = document.querySelector('#checkout')
const qty = document.getElementsByClassName("qty");
const trash = document.getElementsByClassName("fa-times");


Array.from(qty).forEach(function(element) {
    element.addEventListener('click', function(){
      const id = element.dataset.id
      let qty = 1
      if(element.classList.contains('fa-minus-square')){
        qty = -1;
      }

      console.log(qty)
      fetch('cart', {
        method: 'put',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          'id': id,
          'qty': qty,
        })
      })
      .then(response => {
        if (response.ok) return response.json()
      })
      .then(data => {
        console.log(data)
        window.location.reload(true)
      })
    });
});



Array.from(trash).forEach(function(element) {
    element.addEventListener('click', function(){
      console.log(this.parentNode.parentNode.childNodes[7].innerText)
      const id = element.dataset.id


      fetch('cart', {
        method: 'delete',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
         "id": id,
        })
      }).then(function (response) {
        window.location.reload()
      })
    });
});



checkout.addEventListener('click', () => {
    
    let order = document.querySelectorAll('ul')

    console.log(order)
    console.log('checkout')
    fetch('/create-checkout-session', {
    method:'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      }),
    })
    .then(response => {
      if (response.ok) return response.json()
      return response.json().then(json => Promise.reject(json))
    })
    .then(({ url }) =>{
        window.location = url
    }).catch(e =>{
        console.error(e.error)
    })
});