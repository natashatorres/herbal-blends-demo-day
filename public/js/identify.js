let camera_button = document.querySelector("#start-camera");
let video = document.querySelector("#video");
let click_button = document.querySelector("#click-photo");
let canvas = document.querySelector("#canvas");


camera_button.addEventListener('click', async function () {
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
  
});

click_button.addEventListener('click', function () {
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    let image_data_url = canvas.toDataURL('image/jpeg');
    canvas.toBlob(function (blob) {

        let reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function () {
            let base64data = reader.result;
            console.log(base64data);
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
            fetch('https://api.plant.id/v2/identify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Success:', data);
                    //query string name = plant value = data (req.query.plant)
                    let plantIdUrl = `/handlePlantsId?plant=${data.suggestions[0].plant_name}`
                    console.log(plantIdUrl)
                    window.location.href = plantIdUrl;
                })
                .catch((error) => {
                    console.error('Error:', error);
                });
        }

    });

    // data url of the image
    console.log(image_data_url);
});


/// plantID api documentation 
document.querySelector('button').onclick = function sendIdentification() {
    const files = [...document.querySelector('input[type=file]').files];
    const promises = files.map((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const res = event.target.result;
                console.log(res);
                resolve(res);
            }
            reader.readAsDataURL(file)
        })
    })
}
   