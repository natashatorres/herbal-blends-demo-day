//plant at home you can use this app


let camera_button = document.querySelector("#start-camera");
let video = document.querySelector("#video");
let click_button = document.querySelector("#click-photo");
let canvas = document.querySelector("#canvas");
let identification = document.getElementById('identification')

//event listener code, when camera btn is clicked, this code will run
camera_button.addEventListener('click', async function () {
    //gets the video stream
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    //adding video stream to dom, allows you to see what the camera is seeing
    video.srcObject = stream;
    //make camera visible
    video.classList.remove('hidden')
    //clears previous picture taken 
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height)
    //hiding the results of any previous indentificationn
    identification.classList.add('hidden')
});


//event listener code for when the picture is taken
click_button.addEventListener('click', function () {
    //this will hide camera
    video.classList.add('hidden')
    //this will show indentification results area
    identification.classList.remove('hidden')
    //it copies whatever is in the video into camera 
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);


    //takes whatever is in the canvas into a collection of bits, blob(binary large object, big pieces of data)
    
    //when canvas is done turing into blob, call this function with the blob
    canvas.toBlob(function (blob) {
        //this reads the blob
        let reader = new FileReader();
        reader.readAsDataURL(blob);
        //once its done reading, call this function
        reader.onloadend = function () {
            //the result of turing blob into the data url (encoded version of the bits)
            //base64data a way of encoding data
            let base64data = reader.result;
            //this is all the info the plant id api needs
            const data = {
                api_key: "pcyJyiOfcEr5FCQWpqJL9eHrnMEbSquXTrUGwSpp9iYc9xV65o",
                images: [base64data],
                modifiers: ["crops_fast", "similar_images"],
                plant_language: "en",
                plant_details: ["common_names",
                    "url",
                    "name_authority",
                    "wiki_description",
                    "taxonomy",
                    "synonyms"]
            };
            console.log('about to fetch')
            //fetch sends relevant data to plant id api 
            fetch('https://api.plant.id/v2/identify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
                .then(response => response.json())
                //result of the indentification
                .then(data => {
                    console.log('Success:', data);
                    document.querySelector('#name').innerText = `Name: ${data.suggestions[0].plant_name}`
                    document.querySelector('#plantDescription').innerText = `Description: ${data.suggestions[0].plant_details.wiki_description.value}`
                    document.querySelector('#plantImg').src = data.suggestions[0].similar_images[0].url

                    //creating a variable that holds the plant suggestion name to send to the second fetch
                    let plantName = data.suggestions[0].plant_name.toLowerCase()

                    //fetch that checks mongodb data base to see if herb in in stock
                    fetch(`/findPlant/${plantName}`)
                        .then(response => response.json())
                        //if plant 
                        .then(plantResult => {
                            if(plantResult.result){ 
                            console.log(plantResult)
                            const plant = plantResult.result

                            let plantUrl = `/plant?plantname=${plant.name}&plantid=${plant._id}`
                            let button = document.createElement('a')
                            button.href = "/store"
                            let buttonText = document.createTextNode('Order Now')
                            let text = document.createTextNode(`We have ${plantName} in stock!`)
                            let element = document.getElementById('inStock')
                            button.appendChild(buttonText)
                            element.appendChild(text)
                            element.appendChild(button)
                        }
                        })
                        .catch((error) => {
                            console.error('Error:', error);
                        });
                })
                .catch((error) => {
                    console.error('Error:', error);
                });
        }
    });
});


