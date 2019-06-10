const app = new Vue({
  el: '#app',
  delimiters: ['[[', ']]'],
  data: {
    predictions: [],
    canvases: [],
    loading: true,
  },
  mounted: function() {
    const vm = this;
    this.predict()

    const elm = document.querySelector('body');  
    elm.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    elm.addEventListener('drop', (e) => {
        e.preventDefault();
        vm.fileReader(e.dataTransfer.files)
    });
  },
  methods: {
    onFileChange: function(e) {
      if (e.target) this.fileReader(e.target.files)
    },
    fileReader: function(files) {
      const vm = this;
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
    },
    downloadCanvasImage: function() {
      const canvas = document.querySelector('.mainCanvas')
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = parseInt((new Date()).getTime()/1000) + "_0_0.png";
      link.click();
    },
    predict: function(imageFile = './static/sample.jpg') {
      const vm = this
      vm.loading = true
      vm.setupCanvas(imageFile, 128, 128).then((canvases) => {
        if (canvases !== false) {
          for (let i = 0; i < canvases.length; i++) {
            const canvas = canvases[i]
            const b64 = canvas.toDataURL("image/png").replace(/data:image\/png;base64,/, '');
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
          }
        } else {
          alert("顔が検出できませんでした");
          vm.predictions = [];
          vm.loading = false
        }
      })
    },
    setupCanvas: function(imgUrl, resizeW, resizeH) {
      const vm = this
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imgUrl;
        img.onload = async () => {
          const detections = await vm.faceDetect(img)
          vm.canvases = detections
          if (!detections) {
            resolve(false)
          } else {
            setTimeout(() => {
              const canvases = document.querySelectorAll('.mainCanvas')
              for (let i = 0; i < canvases.length; i ++) {
                const detection = detections[i]
                const canvas = canvases[i];
                if (!canvas) return null;
                const context = canvas.getContext("2d");
                if (!context) return null;
                canvas.width = resizeW;
                canvas.height = resizeH;
                const squareW = detection.box.width > detection.box.height ? detection.box.width : detection.box.height
                const squareH = detection.box.width > detection.box.height ? detection.box.width : detection.box.height
                context.drawImage(img, detection.box.x, detection.box.y, squareW, squareH, 0, 0, resizeW, resizeH);
              }
              resolve(canvases);
            }, 100)
          }
        };
        img.onerror = () => reject(null);
      });
    },
    faceDetect: async function(canvas) {
      await faceapi.nets.ssdMobilenetv1.loadFromUri('./static')
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      const detections = await faceapi.detectAllFaces(canvas, options)
      return detections
    }
  }
});

