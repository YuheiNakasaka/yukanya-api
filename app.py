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
from face_embeding import FaceEmbedding
import pickle
import scipy
import re

def member_to_name(label):
    if label == "akariuemura":
        return "植村あかり"
    elif label == "karinmiyamoto":
        return "宮本佳林"
    elif label == "manakainaba":
        return "稲場愛香"
    elif label == "rurudanbara":
        return "段原瑠々"
    elif label == "sayukitakagi":
        return "高木紗友希"
    elif label == "tomokokanazawa":
        return "金澤朋子"
    elif label == "yukamiyazaki":
        return "宮崎由加"

def index_to_member_name(i):
    label = [
        "akariuemura",
        "karinmiyamoto",
        "manakainaba",
        "rurudanbara",
        "sayukitakagi",
        "tomokokanazawa",
        "yukamiyazaki"
    ]
    return member_to_name(label[i])

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.debug = False
CORS(app)

model = load_model('YukanyaModel_vgg_all.h5')
graph = tf.get_default_graph()

@app.route('/', methods=['POST'])
def predict():
    try:
        img_bytes = io.BytesIO(base64.b64decode(request.form['image']))
        face_img = Image.open(img_bytes)
        img_list = np.array([img_to_array(face_img)[:,:,:3] / 255], dtype=np.float32)
        global graph
        with graph.as_default():
            prediction = model.predict(img_list)
            sorted_results = []
            for i, score in enumerate(prediction[0]):
                sorted_results.append([score *  100, index_to_member_name(i)])
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


@app.route('/distance', methods=['POST'])
def predict_distance():
    face_embedding = FaceEmbedding('./models/20180402-114759/20180402-114759.pb')
    pickle_path = 'img_facenet.pkl'

    # 1以上: 残念ながら別人です。強いて言うならOOに近いかもしれません...
    # 1未満: 少しだけOO顔です
    # 0.8未満: まぁまぁOO顔です
    # 0.7未満: かなりOO顔です
    # 0.6未満: ほぼOO顔です
    # 0.5未満: OO本人です
    with open(pickle_path, 'rb') as f:
        data = pickle.load(f)
        img_bytes = io.BytesIO(base64.b64decode(request.form['image']))
        target_feature = np.array([face_embedding.face_embeddings(img_bytes)[0]])
        result = {}
        for k in data:
            result[k] = scipy.spatial.distance.euclidean(data[k], target_feature)
        
        top10 = []
        for k, v in sorted(result.items(), key=lambda x: x[1]):
            top10.append({
                'name': member_to_name(re.sub('--.+', '', k)),
                'score': v
            })
            if len(top10) > 10: break
        
        msg = ""
        top1 = top10[0]
        if top1['score'] < 0.5:
            msg += "あなたは「<span style='font-weight: bold;'>" + top1['name'] + "</span>」本人ですか？ほとんど区別がつきません。"
        elif top1['score'] < 0.6:
            msg += "あなたはほぼ「<span style='font-weight: bold;'>" + top1['name'] + "</span>」顔です。誰に似てるか聞かれたら<span style='font-weight: bold;'>" + top1['name'] + "</span>と答えても問題ないでしょう"
        elif top1['score'] < 0.7:
            msg += "かなり「<span style='font-weight: bold;'>" + top1['name'] +"</span>」に近い顔です。髪型や骨格など大まかな部分が似ています。"
        elif top1['score'] < 0.8:
            msg += "まぁまぁ「<span style='font-weight: bold;'>" + top1['name'] + "</span>」顔です。一部のパーツが少し似ています。"
        elif top1['score'] < 1:
            msg += "ほんの少しだけ「<span style='font-weight: bold;'>" + top1['name'] + "</span>」の顔に似ています。ただし、ほんの少し似ているだけなので勘違いしないでください。"
        else:
            msg += "あなたはJuice=Juiceの誰にも似ている顔ではありません。全くの別人です。変な「背伸び」はやめて自分らしく生きてください。"

    response = {
        'data': top10,
        'message': msg
    }
    return jsonify(response), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(port=port)