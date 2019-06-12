Vue.component('prediction-component', {
  data: function () {
    return {
      predictions: [],
    }
  },
  delimiters: ['[[', ']]'],
  props: ['loading', 'detection', 'imgurl'],
  template: `
  <div>
    <canvas class="mainCanvas" ref="faceCanvas" @click="downloadCanvasImage" v-show="!loading"></canvas>
    <div class="detail" v-if="loading === false">
      <div class="labels">
        <div v-for="(pred, index) in predictions">
          <p class="label-name" :class="index === 0 ? 'first' : ''">[[ pred[0] ]]: [[ pred[1] ]]%</p>
        </div>
      </div>
    </div>
  </div>
  `,
  watch: {
    detection: function() {
      this.renderCanvas()
    },
  },
  mounted: function() {
    this.renderCanvas()
  },
  methods: {
    downloadCanvasImage: function() {
      const canvas = document.querySelector('.mainCanvas')
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = parseInt((new Date()).getTime()/1000) + "_0_0.png";
      link.click();
    },
    renderCanvas: function() {
      const vm = this
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = this.imgurl;
      img.onload = async () => {
        const canvas = vm.$refs.faceCanvas;
        if (!canvas) return null;
        const context = canvas.getContext("2d");
        if (!context) return null;
        EXIF.getData(img, async () => {
          const tmpCanvas = document.createElement('canvas')
          const ctx = tmpCanvas.getContext('2d')
          let rotate = 0
          if (EXIF.getAllTags(img).Orientation == 6) {
            rotate = 90
          } else if (EXIF.getAllTags(img).Orientation == 3) {
            rotate = 180
          } else if (EXIF.getAllTags(img).Orientation == 8) {
            rotate = 270
          }

          if (rotate == 90 || rotate == 270) {
            tmpCanvas.width = img.height;
            tmpCanvas.height = img.width;
          } else {
            tmpCanvas.width = img.width;
            tmpCanvas.height = img.height;
          }

          if (rotate && rotate > 0) {
            ctx.rotate(rotate * Math.PI / 180);
            if (rotate == 90)
              ctx.translate(0, -img.height);
            else if (rotate == 180)
              ctx.translate(-img.width, -img.height);
            else if (rotate == 270)
              ctx.translate(-img.width, 0);
          }
          ctx.drawImage(img, 0, 0, img.width, img.height);

          canvas.width = 128;
          canvas.height = 128;
          const squareW = vm.detection.box.width > vm.detection.box.height ? vm.detection.box.width : vm.detection.box.height
          const squareH = vm.detection.box.width > vm.detection.box.height ? vm.detection.box.width : vm.detection.box.height
          context.drawImage(tmpCanvas, vm.detection.box.x, vm.detection.box.y, squareW, squareH, 0, 0, 128, 128);
          vm.predict()
        })
      };
      img.onerror = () => reject(null);
    },
    predict: function() {
      const vm = this
      vm.loading = true
      const canvas = vm.$refs.faceCanvas;
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
    },
  }
})


const app = new Vue({
  el: '#app',
  delimiters: ['[[', ']]'],
  data: {
    imgUrl: '',
    detections: [],
    loading: false,
  },
  mounted: function() {
    const vm = this;
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
        vm.imgUrl = reader.result
        vm.faceRendering(reader.result)
      };
      reader.readAsDataURL(files[0]);
    },
    faceRendering: function(imageFile = './static/sample.jpg') {
      const vm = this
      vm.loading = true
      vm.imgUrl = imageFile
      vm.setupCanvas(imageFile)
    },
    setupCanvas: function(imgUrl) {
      const vm = this
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imgUrl;
      img.onload = () => {
        EXIF.getData(img, async () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          let rotate = 0
          if (EXIF.getAllTags(img).Orientation == 6) {
            rotate = 90
          } else if (EXIF.getAllTags(img).Orientation == 3) {
            rotate = 180
          } else if (EXIF.getAllTags(img).Orientation == 8) {
            rotate = 270
          }
          // Canvasのサイズを指定
          if (rotate == 90 || rotate == 270) {
            canvas.width = img.height;
            canvas.height = img.width;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }
          // 画像の回転
          if (rotate && rotate > 0) {
            ctx.rotate(rotate * Math.PI / 180);
            if (rotate == 90)
              ctx.translate(0, -img.height);
            else if (rotate == 180)
              ctx.translate(-img.width, -img.height);
            else if (rotate == 270)
              ctx.translate(-img.width, 0);
          }
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const detections = await vm.faceDetect(canvas)
          vm.detections = detections
          if (detections.length === 0) alert("顔が検出できませんでした");
          vm.loading = false
        })
      };
      img.onerror = () => reject(null);
    },
    faceDetect: async function(canvas) {
      await faceapi.nets.ssdMobilenetv1.loadFromUri('./static')
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      const detections = await faceapi.detectAllFaces(canvas, options)
      return detections
    }
  }
});

