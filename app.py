#!/bin/env python
# coding: utf-8

import os
import io
import base64
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL  import Image
from keras.models import load_model
from keras.preprocessing.image import img_to_array
import tensorflow as tf
from flask_cors import CORS

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.debug = False
CORS(app)

model = load_model('YukanyaModel_vgg_all.h5')
graph = tf.get_default_graph()

@app.route('/', methods=['POST'])
def predict():
    def member_to_name(i):
        label = [
            "akariuemura",
            "karinmiyamoto",
            "manakainaba",
            "rurudanbara",
            "sayukitakagi",
            "tomokokanazawa",
            "yukamiyazaki"
        ]
        member = label[i]
        if member == "akariuemura":
            return "植村あかり"
        elif member == "karinmiyamoto":
            return "宮本佳林"
        elif member == "manakainaba":
            return "稲場愛香"
        elif member == "rurudanbara":
            return "段原瑠々"
        elif member == "sayukitakagi":
            return "高木紗友希"
        elif member == "tomokokanazawa":
            return "金澤朋子"
        elif member == "yukamiyazaki":
            return "宮崎由加"

    try:
        img_bytes = io.BytesIO(base64.b64decode(request.form['image']))
        face_img = Image.open(img_bytes)
        img_list = np.array([img_to_array(face_img)[:,:,:3] / 255], dtype=np.float32)
        global graph
        with graph.as_default():
            prediction = model.predict(img_list)
            sorted_results = []
            for i, score in enumerate(prediction[0]):
                sorted_results.append([score *  100, member_to_name(i)])
            sorted_results.sort()
            for result in sorted_results[::-1]:
                print(result[1] + ': ' + str(result[0]) + '%')
        response = {
            'data': sorted_results
        }
        return jsonify(response), 200
    except:
        response = {
            'data': []
        }
        return jsonify(response), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(port=port)