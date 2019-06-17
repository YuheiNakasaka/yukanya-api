import tensorflow as tf
import facenet
from PIL import Image
import glob
import numpy as np
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import os
import scipy
import pickle

class FaceEmbedding(object):

    def __init__(self, model_path):
        facenet.load_model(model_path)
        
        self.input_image_size = 160
        self.sess = tf.Session()
        self.images_placeholder = tf.get_default_graph().get_tensor_by_name("input:0")
        self.embeddings = tf.get_default_graph().get_tensor_by_name("embeddings:0")
        self.phase_train_placeholder = tf.get_default_graph().get_tensor_by_name("phase_train:0")
        self.embedding_size = self.embeddings.get_shape()[1]
        
    def __del__(self):
        self.sess.close()
        
    def load_image(self, image_path, width, height, mode):
        image = Image.open(image_path)
        image = image.resize([width, height], Image.BILINEAR)
        return np.array(image.convert(mode))
        
    def face_embeddings(self, image_path):
        image = self.load_image(image_path, self.input_image_size, self.input_image_size, 'RGB')
        prewhitened = facenet.prewhiten(image)
        prewhitened = prewhitened.reshape(-1, prewhitened.shape[0], prewhitened.shape[1], prewhitened.shape[2])
        feed_dict = { self.images_placeholder: prewhitened, self.phase_train_placeholder: False }
        embeddings = self.sess.run(self.embeddings, feed_dict=feed_dict)
        return embeddings

if __name__ == '__main__':
    FACE_MEDEL_PATH = './models/20180402-114759/20180402-114759.pb'
    face_embedding = FaceEmbedding(FACE_MEDEL_PATH)
    pickle_path = 'img_facenet.pkl'

    with open(pickle_path, 'rb') as f:
        data = pickle.load(f)
        target_feature = np.array([face_embedding.face_embeddings("./3_170_491.jpg")[0]])
        result = {}
        for k in data:
            result[k] = scipy.spatial.distance.euclidean(data[k], target_feature)
        i = 1
        for k, v in sorted(result.items(), key=lambda x: x[1]):
            print(i, k ,v)
            i += 1
            if i > 10: break