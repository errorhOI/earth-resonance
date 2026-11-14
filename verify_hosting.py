"""Exercise the public API and range-served media without a browser or network archive."""
import hashlib
import json
import unittest
from unittest.mock import patch
from pathlib import Path
import profile_service
from web_app import app, STATIC

class HostedAppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=app.test_client()
        profile_service.FIELDS=None
        profile_service.build_cell.cache_clear()

    def test_real_profiles_without_archive_access(self):
        with patch('profile_service.RemoteFile',side_effect=AssertionError('Archive access not expected')):
            for lat,lon in [(39,-53),(38.2,-38.7),(-22,-140),(3,101),(90,180),(-90,-180)]:
                response=self.client.get(f'/api/profile?lat={lat}&lon={lon}')
                self.assertEqual(response.status_code,200)
                data=response.get_json();p=data['profile']
                self.assertEqual(len(p['rays']),24)
                self.assertGreater(len(p['height_m']),20)
                self.assertEqual(data['time'],'2025-01-01T01:30:00Z')
                self.assertEqual(response.headers['Cache-Control'],'no-store')

    def test_bad_coordinates(self):
        for query in ['', '?lat=0','?lat=nan&lon=0','?lat=91&lon=0','?lat=0&lon=181','?lat=x&lon=0']:
            self.assertEqual(self.client.get('/api/profile'+query).status_code,400)

    def test_static_and_private_files(self):
        with self.client.get('/') as response:self.assertEqual(response.status_code,200)
        for url in ['/server.py','/data/hosted-fields.npz','/.git/config','/../README.md','/api/missing']:
            self.assertEqual(self.client.get(url).status_code,404,url)
        self.assertEqual(self.client.post('/api/profile').status_code,405)

    def test_health(self):
        self.assertTrue(self.client.get('/api/health').get_json()['ready'])

    def test_video_ranges_and_integrity(self):
        s=(STATIC/'media-data.js').read_text(encoding='utf-8')
        media=json.loads(s.split('=',1)[1].rstrip(';\n'))
        for name in ['ocean','aerosols']:
            self.assertNotIn('video_base64',media[name])
            path=STATIC/media[name]['video_url']
            with path.open('rb') as f:expected=f.read(1024)
            response=self.client.get('/'+media[name]['video_url'],headers={'Range':'bytes=0-1023'})
            self.assertEqual(response.status_code,206)
            self.assertEqual(response.data,expected)
            response.close()
            if name=='ocean':self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),media[name]['video_sha256'])

    def test_compressed_assets(self):
        import gzip
        response=self.client.get('/app.js',headers={'Accept-Encoding':'gzip'})
        self.assertEqual(response.headers['Content-Encoding'],'gzip')
        self.assertEqual(gzip.decompress(response.data),(STATIC/'app.js').read_bytes())
        response.close()

if __name__=='__main__':unittest.main(verbosity=2)
