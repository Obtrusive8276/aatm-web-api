package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	// Initialize database
	InitDB()

	// Create app instance
	app := NewApp()

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:*", "http://127.0.0.1:*"},
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			// Allow same-origin requests and localhost
			return origin == "" || origin == r.Host ||
				strings.HasPrefix(origin, "http://localhost") ||
				strings.HasPrefix(origin, "http://127.0.0.1")
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Serve static files
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(staticFS))

	// Routes
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFileFS(w, r, staticFS, "index.html")
	})

	r.Get("/static/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/static/", fileServer).ServeHTTP(w, r)
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// TMDB Proxy - keeps API key secure on backend
	tmdbAPIKey := os.Getenv("TMDB_API_KEY")
	if tmdbAPIKey == "" {
		tmdbAPIKey = "49d8d37e45764e7c6794ed7dd2d896d4" // Fallback for development
	}

	r.Get("/api/tmdb/search/{type}", func(w http.ResponseWriter, r *http.Request) {
		mediaType := chi.URLParam(r, "type")
		query := r.URL.Query().Get("query")
		lang := r.URL.Query().Get("language")
		if lang == "" {
			lang = "fr-FR"
		}

		if mediaType != "movie" && mediaType != "tv" {
			http.Error(w, "type must be 'movie' or 'tv'", http.StatusBadRequest)
			return
		}

		url := fmt.Sprintf("https://api.themoviedb.org/3/search/%s?api_key=%s&query=%s&language=%s",
			mediaType, tmdbAPIKey, query, lang)

		resp, err := http.Get(url)
		if err != nil {
			http.Error(w, "TMDB request failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})

	r.Get("/api/tmdb/{type}/{id}", func(w http.ResponseWriter, r *http.Request) {
		mediaType := chi.URLParam(r, "type")
		id := chi.URLParam(r, "id")
		lang := r.URL.Query().Get("language")
		if lang == "" {
			lang = "fr-FR"
		}

		if mediaType != "movie" && mediaType != "tv" {
			http.Error(w, "type must be 'movie' or 'tv'", http.StatusBadRequest)
			return
		}

		url := fmt.Sprintf("https://api.themoviedb.org/3/%s/%s?api_key=%s&language=%s",
			mediaType, id, tmdbAPIKey, lang)

		resp, err := http.Get(url)
		if err != nil {
			http.Error(w, "TMDB request failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})

	// Directory operations
	r.Get("/api/files", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		files, err := app.ListDirectory(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	})

	r.Get("/api/directory-size", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		size, err := app.GetDirectorySize(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"size": size})
	})

	// Analyze directory to detect if it's a series pack
	r.Get("/api/analyze-directory", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		result, err := app.AnalyzeDirectory(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	// MediaInfo
	r.Get("/api/mediainfo", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		format := r.URL.Query().Get("format")

		// Format text pour NFO, sinon JSON pour parsing
		if format == "text" {
			info, err := app.GetMediaInfoText(path)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"mediainfo": info})
		} else {
			info, err := app.GetMediaInfo(path)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(info)
		}
	})

	// Torrent creation
	r.Post("/api/torrent/create", func(w http.ResponseWriter, r *http.Request) {
		var req CreateTorrentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		torrentPath, err := app.CreateTorrent(req.SourcePath, req.Trackers, req.Comment, req.IsPrivate, req.TorrentName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"torrentPath": torrentPath})
	})

	// NFO operations
	r.Post("/api/nfo/save", func(w http.ResponseWriter, r *http.Request) {
		var req SaveNfoRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		nfoPath, err := app.SaveNfo(req.SourcePath, req.Content, req.TorrentName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"nfoPath": nfoPath})
	})

	// Steam API proxy (to avoid CORS issues)
	r.Get("/api/steam/search", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("q")
		if query == "" {
			http.Error(w, "query parameter required", http.StatusBadRequest)
			return
		}
		resp, err := http.Get("https://store.steampowered.com/api/storesearch/?term=" + query + "&l=french&cc=FR")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	})

	r.Get("/api/steam/details", func(w http.ResponseWriter, r *http.Request) {
		appid := r.URL.Query().Get("appid")
		if appid == "" {
			http.Error(w, "appid parameter required", http.StatusBadRequest)
			return
		}
		resp, err := http.Get("https://store.steampowered.com/api/appdetails?appids=" + appid + "&l=french")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, resp.Body)
	})

	// qBittorrent integration
	r.Post("/api/qbittorrent/upload", func(w http.ResponseWriter, r *http.Request) {
		var req QBittorrentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err := app.UploadToQBittorrent(req.TorrentPath, req.QbitUrl, req.Username, req.Password)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "uploaded"})
	})

	r.Post("/api/qbittorrent/remove", func(w http.ResponseWriter, r *http.Request) {
		var req QBittorrentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err := app.RemoveFromQBittorrent(req.TorrentPath, req.QbitUrl, req.Username, req.Password)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "removed"})
	})

	// Generic torrent client integration (uses settings to determine which client)
	r.Post("/api/torrent-client/upload", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TorrentPath string `json:"torrentPath"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		settings := app.GetSettings()
		err := app.UploadToTorrentClient(req.TorrentPath, settings)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "uploaded", "client": settings.TorrentClient})
	})

	r.Post("/api/torrent-client/remove", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TorrentPath string `json:"torrentPath"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		settings := app.GetSettings()
		err := app.RemoveFromTorrentClient(req.TorrentPath, settings)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "removed", "client": settings.TorrentClient})
	})

	// Hardlink creation
	r.Post("/api/hardlink/create", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			SourcePath   string   `json:"sourcePath"`
			HardlinkDirs []string `json:"hardlinkDirs"`
			TorrentName  string   `json:"torrentName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Find the matching hardlink directory on the same device
		destDir, err := app.FindMatchingHardlinkDir(req.SourcePath, req.HardlinkDirs)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Create the hardlink
		hardlinkPath, err := app.CreateHardlink(req.SourcePath, destDir, req.TorrentName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":       "created",
			"hardlinkPath": hardlinkPath,
		})
	})

	// La Cale integration
	r.Post("/api/lacale/preview-tags", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MediaType   string      `json:"mediaType"`
			ReleaseInfo ReleaseInfo `json:"releaseInfo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		tags, err := app.GetLaCaleTagsPreview(req.MediaType, req.ReleaseInfo)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string][]string{"tags": tags})
	})

	// Get all available tags for a media type, organized by category
	r.Post("/api/lacale/all-tags", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MediaType   string      `json:"mediaType"`
			ReleaseInfo ReleaseInfo `json:"releaseInfo"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		allTags, selectedTags, err := app.GetLaCaleAllTags(req.MediaType, req.ReleaseInfo)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"categories":   allTags,
			"selectedTags": selectedTags,
		})
	})

	r.Post("/api/lacale/upload", func(w http.ResponseWriter, r *http.Request) {
		var req LaCaleUploadRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err := app.UploadToLaCale(
			req.TorrentPath,
			req.NfoPath,
			req.Title,
			req.Description,
			req.TmdbId,
			req.MediaType,
			req.ReleaseInfo,
			req.Passkey,
			req.Email,
			req.Password,
			req.CustomTags,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "uploaded"})
	})

	// Settings
	r.Get("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		settings := app.GetSettings()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(settings)
	})

	r.Post("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		var settings AppSettings
		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := app.SaveSettings(settings); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
	})

	// Processed files
	r.Post("/api/processed/mark", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := app.MarkProcessed(req.Path); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "marked"})
	})

	r.Delete("/api/processed", func(w http.ResponseWriter, r *http.Request) {
		if err := app.ClearProcessedFiles(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
	})

	r.Get("/api/processed", func(w http.ResponseWriter, r *http.Request) {
		files, err := app.GetAllProcessedFiles()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(files)
	})

	// File operations
	r.Delete("/api/file", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		if err := app.DeleteFile(path); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	})

	// Get port from env or default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logInfo("🚀 Starting AATM API server on port %s", port)
	logInfo("Server listening on http://localhost:%s", port)
	err = http.ListenAndServe(":"+port, r)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// Request types
type CreateTorrentRequest struct {
	SourcePath  string   `json:"sourcePath"`
	Trackers    []string `json:"trackers"`
	Comment     string   `json:"comment"`
	IsPrivate   bool     `json:"isPrivate"`
	TorrentName string   `json:"torrentName"`
}

type SaveNfoRequest struct {
	SourcePath  string `json:"sourcePath"`
	Content     string `json:"content"`
	TorrentName string `json:"torrentName"`
}

type QBittorrentRequest struct {
	TorrentPath string `json:"torrentPath"`
	QbitUrl     string `json:"qbitUrl"`
	Username    string `json:"username"`
	Password    string `json:"password"`
}

type LaCaleUploadRequest struct {
	TorrentPath string      `json:"torrentPath"`
	NfoPath     string      `json:"nfoPath"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	TmdbId      string      `json:"tmdbId"`
	MediaType   string      `json:"mediaType"`
	ReleaseInfo ReleaseInfo `json:"releaseInfo"`
	Passkey     string      `json:"passkey"`
	Email       string      `json:"email"`
	Password    string      `json:"password"`
	CustomTags  []string    `json:"customTags,omitempty"` // Optional: override auto-detected tags
}
