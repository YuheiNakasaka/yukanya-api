#!/bin/env python
# coding: utf-8

import os
import io
import base64
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL  import Image
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

face_embedding = FaceEmbedding('./models/20180402-114759/20180402-114759.pb')
f = open('img_facenet.pkl', 'rb')
data = pickle.load(f)

@app.route('/distance', methods=['POST'])
def predict_distance():
    # 1以上: 残念ながら別人です。強いて言うならOOに近いかもしれません...
    # 1未満: 少しだけOO顔です
    # 0.8未満: まぁまぁOO顔です
    # 0.7未満: かなりOO顔です
    # 0.6未満: ほぼOO顔です
    # 0.5未満: OO本人です
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
    if top1['score'] < 0.3:
        msg += "あなたは「<span style='font-weight: bold;'>" + top1['name'] + "</span>」本人です。紛れもなく本人です。"
    elif top1['score'] < 0.5:
        msg += "あなたは「<span style='font-weight: bold;'>" + top1['name'] + "</span>」本人ですか？ほとんど区別がつきません。"
    elif top1['score'] < 0.55:
        msg += "あなたは「<span style='font-weight: bold;'>" + top1['name'] + "</span>」顔です。誰に似てるか聞かれたら<span style='font-weight: bold;'>" + top1['name'] + "</span>と答えても問題ないでしょう"
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