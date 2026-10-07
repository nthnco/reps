import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import SinglePageApp


@pytest.fixture
def client(tmp_path):
    (tmp_path / "index.html").write_text("<title>Reps</title>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log('hi')")
    app = FastAPI()
    app.mount("/", SinglePageApp(directory=tmp_path, html=True))
    return TestClient(app)


@pytest.mark.parametrize("url", ["/", "/problems/7", "/problems/7/"])
def test_page_urls_get_the_react_app(client, url):
    response = client.get(url)
    assert response.status_code == 200
    assert "<title>Reps</title>" in response.text


def test_real_files_are_served(client):
    assert client.get("/assets/app.js").text == "console.log('hi')"


@pytest.mark.parametrize("url", ["/assets/missing.js", "/api/nope"])
def test_missing_files_and_api_paths_stay_404(client, url):
    assert client.get(url).status_code == 404
