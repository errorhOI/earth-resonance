import runpy
import sys
from pathlib import Path

FUNCTIONS = Path(__file__).resolve().parent / 'functions'
sys.path.insert(0, str(FUNCTIONS))
if __name__ == '__main__':
    runpy.run_path(str(FUNCTIONS / 'prepare_hosting.py'), run_name='__main__')
