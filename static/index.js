const app = new Vue({
  el: '#app',
  delimiters: ['[[', ']]'],
  data: {
    predictions: [],
    loading: true,
  },
  mounted: function() {
    this.predict()
  },
  methods: {
    onFileChange: function(e) {
      const vm = this
      if (e.target) {
        const files = e.target.files;
        if (!files) return;
        if (!files[0].type.match(/image.*/)) {
          alert('画像ファイルをアップロードしてください')
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          if (!reader.result || reader.result instanceof ArrayBuffer) return;
          vm.predict(reader.result)
        };
        reader.readAsDataURL(files[0]);
      }
    },
    predict: function(imageFile = './static/sample.jpg') {
      const vm = this
      vm.loading = true
      setupCanvas(imageFile, 64, 64).then((resp) => {
        if (resp !== false) {
          const b64 = resp.canvas.toDataURL("image/png").replace(/data:image\/png;base64,/, '');
          const formData = new FormData();
          formData.append("image", b64);

          window.superagent
            .post('/')
            .send(formData)
            .then(res => {
              const results = []
              const data = res.body.data
              for (let i = 0; i < data.length; i++) {
                results.push([data[i][1], parseFloat(data[i][0]).toFixed(2)])
              }
              vm.predictions = results.sort((a, b) => {
                return b[1] - a[1]
              })
            });
          vm.loading = false
        } else {
          alert("顔が検出できませんでした");
          vm.predictions = [];
          vm.loading = false
        }
      })
    }
  }
});

async function faceDetect(canvas) {
  await faceapi.nets.ssdMobilenetv1.loadFromUri('./static')
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
  const detections = await faceapi.detectSingleFace(canvas, options) 
  return detections
}

function setupCanvas(imgUrl, resizeW, resizeH) {
  const canvas = document.querySelector('#mainCanvas');
  const prevCanvas = document.querySelector('#previewCanvas');
  if (!canvas) return null;
  const context = canvas.getContext("2d");
  const prevContext = prevCanvas.getContext("2d");
  if (!context) return null;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgUrl;
    img.onload = async () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      prevContext.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
      const detections = await faceDetect(img)
      if (!detections) {
        resolve(false)
      } else {
        canvas.width = resizeW;
        canvas.height = resizeH;
        prevCanvas.width = img.width;
        prevCanvas.height = img.height;
        prevContext.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height)
        const squareW = detections.box.width > detections.box.height ? detections.box.width : detections.box.height
        const squareH = detections.box.width > detections.box.height ? detections.box.width : detections.box.height
        context.drawImage(img, detections.box.x, detections.box.y, squareW, squareH, 0, 0, resizeW, resizeH);
        const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log(detections.box.x, detections.box.y, detections.box.width, detections.box.height)
        console.log(detections.box.x, detections.box.y, squareW, squareH)
        resolve({
          canvas: canvas,
          context: context,
          imgData: imgData,
          pixels: imgData.data,
          width: canvas.width,
          height: canvas.height
        });
      }
    };
    img.onerror = () => reject(null);
  });
}
