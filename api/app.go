package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/anacrolix/torrent/bencode"
	"github.com/anacrolix/torrent/metainfo"
)

// Supported media extensions
var videoExtensions = map[string]bool{
	".mkv": true, ".mp4": true, ".avi": true, ".wmv": true, ".m4v": true,
}

var ebookExtensions = map[string]bool{
	".epub": true, ".pdf": true, ".mobi": true, ".azw3": true,
	".cbz": true, ".cbr": true, ".djvu": true,
}

var gameExtensions = map[string]bool{
	".iso": true, ".nsp": true, ".xci": true, ".pkg": true,
	".zip": true, ".rar": true, ".7z": true,
}

// ============ MEDIAINFO STRUCTURES ============

type MediaInfoResponse struct {
	Media MediaInfoMedia `json:"media"`
}

type MediaInfoMedia struct {
	Ref   string           `json:"@ref"`
	Track []MediaInfoTrack `json:"track"`
}

type MediaInfoTrack struct {
	Type               string `json:"@type"`
	VideoCount         string `json:"VideoCount,omitempty"`
	AudioCount         string `json:"AudioCount,omitempty"`
	TextCount          string `json:"TextCount,omitempty"`
	FileExtension      string `json:"FileExtension,omitempty"`
	Format             string `json:"Format,omitempty"`
	FormatInfo         string `json:"Format_Info,omitempty"`
	FormatCommercial   string `json:"Format_Commercial,omitempty"`
	CodecID            string `json:"CodecID,omitempty"`
	FileSize           string `json:"FileSize,omitempty"`
	Duration           string `json:"Duration,omitempty"`
	OverallBitRate     string `json:"OverallBitRate,omitempty"`
	EncodedApplication string `json:"Encoded_Application,omitempty"`
	EncodedLibrary     string `json:"Encoded_Library,omitempty"`
	// Video specific
	Width                          string `json:"Width,omitempty"`
	Height                         string `json:"Height,omitempty"`
	PixelAspectRatio               string `json:"PixelAspectRatio,omitempty"`
	DisplayAspectRatio             string `json:"DisplayAspectRatio,omitempty"`
	FrameRate                      string `json:"FrameRate,omitempty"`
	FrameRateMode                  string `json:"FrameRate_Mode,omitempty"`
	BitRate                        string `json:"BitRate,omitempty"`
	BitDepth                       string `json:"BitDepth,omitempty"`
	ChromaSubsampling              string `json:"ChromaSubsampling,omitempty"`
	ColourPrimaries                string `json:"colour_primaries,omitempty"`
	TransferCharacteristics        string `json:"transfer_characteristics,omitempty"`
	MatrixCoefficients             string `json:"matrix_coefficients,omitempty"`
	HDRFormat                      string `json:"HDR_Format,omitempty"`
	HDRFormatCompatibility         string `json:"HDR_Format_Compatibility,omitempty"`
	MasteringDisplayColorPrimaries string `json:"MasteringDisplay_ColorPrimaries,omitempty"`
	MasteringDisplayLuminance      string `json:"MasteringDisplay_Luminance,omitempty"`
	// Audio specific
	Channels         string `json:"Channels,omitempty"`
	ChannelPositions string `json:"ChannelPositions,omitempty"`
	ChannelLayout    string `json:"ChannelLayout,omitempty"`
	SamplingRate     string `json:"SamplingRate,omitempty"`
	SamplingCount    string `json:"SamplingCount,omitempty"`
	BitRateMode      string `json:"BitRate_Mode,omitempty"`
	CompressionMode  string `json:"Compression_Mode,omitempty"`
	// Common
	Language       string `json:"Language,omitempty"`
	LanguageString string `json:"Language_String,omitempty"`
	Default        string `json:"Default,omitempty"`
	Forced         string `json:"Forced,omitempty"`
	Title          string `json:"Title,omitempty"`
}

// ============ LOGGING HELPERS ============

// logInfo logs an info-level message with timestamp
func logInfo(format string, args ...interface{}) {
	log.Printf("[INFO] "+format, args...)
}

// logError logs an error-level message with timestamp
func logError(format string, args ...interface{}) {
	log.Printf("[ERROR] "+format, args...)
}

// logWarn logs a warning-level message with timestamp
func logWarn(format string, args ...interface{}) {
	log.Printf("[WARN] "+format, args...)
}

// shortPath returns just the filename/dirname for cleaner logs
func shortPath(path string) string {
	return filepath.Base(path)
}

// renameVideoFilesInTorrent renames video files in the torrent Info to match the torrent name
// Only renames single video files at the root level (consistent with renameVideoInDir)
func renameVideoFilesInTorrent(info *metainfo.Info, torrentName string) {
	logInfo("renameVideoFilesInTorrent called with torrentName: %s, files count: %d, info.Name: %s, info.Length: %d", torrentName, len(info.Files), info.Name, info.Length)

	// Case 1: Single file torrent (Length is set, Files is empty)
	if len(info.Files) == 0 && info.Length > 0 {
		// For single file, the name is in info.Name and is just the filename without extension usually
		// Since we already set info.Name = torrentName, we need to add the extension if it's a video
		// But info.Name is already set to torrentName, so we need to check if we need to add extension
		logInfo("renameVideoFilesInTorrent: single file mode detected (Files empty, Length: %d)", info.Length)
		// info.Name is already set to torrentName by caller, nothing more to do
		return
	}

	if len(info.Files) == 0 {
		logWarn("renameVideoFilesInTorrent: no files in torrent and no length")
		return
	}

	// Case 2: Single file in Files list (legacy/multi-file mode with just one file)
	if len(info.Files) == 1 && len(info.Files[0].Path) == 1 {
		fileName := info.Files[0].Path[0]
		ext := filepath.Ext(fileName)
		logInfo("renameVideoFilesInTorrent: single file in Files detected - fileName: %s, ext: %s", fileName, ext)
		if isVideoFile(strings.ToLower(ext)) {
			// Rename the file to match torrent name
			newName := torrentName + ext
			logInfo("renameVideoFilesInTorrent: single file - '%s' -> '%s'", fileName, newName)
			info.Files[0].Path[0] = newName
		}
		return
	}

	// Case 3: Multi-file torrents, only rename root-level video files
	videoFileCount := 0
	videoFileIndex := -1

	for i, file := range info.Files {
		// Check if it's a root-level file (path length 1) and is a video
		if len(file.Path) == 1 {
			ext := filepath.Ext(file.Path[0])
			if isVideoFile(strings.ToLower(ext)) {
				videoFileCount++
				videoFileIndex = i
			}
		}
	}

	logInfo("renameVideoFilesInTorrent: multi-file detected - videoFileCount: %d, videoFileIndex: %d", videoFileCount, videoFileIndex)

	// Only rename if there's exactly one video file at root level (consistent with renameVideoInDir)
	if videoFileCount == 1 && videoFileIndex >= 0 {
		ext := filepath.Ext(info.Files[videoFileIndex].Path[0])
		newName := torrentName + ext
		logInfo("renameVideoFilesInTorrent: multi-file - '%s' -> '%s'", info.Files[videoFileIndex].Path[0], newName)
		info.Files[videoFileIndex].Path[0] = newName
	}
}

// isMediaFile checks if the extension is a supported media file

func isMediaFile(ext string) bool {
	return videoExtensions[ext] || ebookExtensions[ext] || gameExtensions[ext]
}

// isVideoFile checks if the extension is a video file
func isVideoFile(ext string) bool {
	return videoExtensions[ext]
}

// isEbookFile checks if the extension is an ebook file
func isEbookFile(ext string) bool {
	return ebookExtensions[ext]
}

// isGameFile checks if the extension is a game file
func isGameFile(ext string) bool {
	return gameExtensions[ext]
}

// FileInfo struct to hold file details
type FileInfo struct {
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	IsDir       bool   `json:"isDir"`
	IsProcessed bool   `json:"isProcessed"`
	HasMedia    bool   `json:"hasMedia,omitempty"`
	MediaType   string `json:"mediaType,omitempty"` // "video" or "ebook"
}

// App struct
type App struct {
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// ListDirectory returns the contents of the given directory
func (a *App) ListDirectory(path string) ([]FileInfo, error) {
	if path == "" {
		return []FileInfo{}, nil
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	files := []FileInfo{}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		isProc := isProcessed(fullPath)

		if entry.IsDir() {
			// Show all directories to allow navigation
			// Check if directory contains media files (directly or in subdirs)
			hasMedia := dirContainsMedia(fullPath)
			files = append(files, FileInfo{
				Name:        entry.Name(),
				Size:        info.Size(),
				IsDir:       true,
				IsProcessed: isProc,
				HasMedia:    hasMedia,
			})
		} else {
			// Check file extension (already lowercased)
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if isMediaFile(ext) {
				mediaType := "video"
				if isEbookFile(ext) {
					mediaType = "ebook"
				} else if isGameFile(ext) {
					mediaType = "game"
				}
				files = append(files, FileInfo{
					Name:        entry.Name(),
					Size:        info.Size(),
					IsDir:       false,
					IsProcessed: isProc,
					MediaType:   mediaType,
				})
			}
		}
	}
	return files, nil
}

// dirContainsMedia checks if a directory contains media files (recursively, max 2 levels)
func dirContainsMedia(path string) bool {
	return dirContainsMediaDepth(path, 0, 2)
}

func dirContainsMediaDepth(path string, currentDepth, maxDepth int) bool {
	if currentDepth > maxDepth {
		return false
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if entry.IsDir() {
			if dirContainsMediaDepth(filepath.Join(path, entry.Name()), currentDepth+1, maxDepth) {
				return true
			}
		} else {
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if isMediaFile(ext) {
				return true
			}
		}
	}
	return false
}

// findFirstVideoFile finds the first video file in a directory (sorted alphabetically)
func findFirstVideoFile(dirPath string) (string, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return "", err
	}

	// Sort entries by name
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() {
			// Recurse into subdirectories
			subFile, err := findFirstVideoFile(filepath.Join(dirPath, entry.Name()))
			if err == nil && subFile != "" {
				return subFile, nil
			}
		} else {
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if isVideoFile(ext) {
				return filepath.Join(dirPath, entry.Name()), nil
			}
		}
	}
	return "", fmt.Errorf("no video file found in directory")
}

// DirectoryAnalysis contains the result of analyzing a directory
type DirectoryAnalysis struct {
	IsDirectory    bool     `json:"isDirectory"`
	IsSeriesPack   bool     `json:"isSeriesPack"`
	VideoFiles     []string `json:"videoFiles"`
	FirstVideoFile string   `json:"firstVideoFile"`
	DetectedSeason string   `json:"detectedSeason,omitempty"`
	EpisodeCount   int      `json:"episodeCount"`
}

// AnalyzeDirectory analyzes a directory to detect if it's a series pack
func (a *App) AnalyzeDirectory(dirPath string) (*DirectoryAnalysis, error) {
	result := &DirectoryAnalysis{
		VideoFiles: []string{},
	}

	fi, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat path: %w", err)
	}

	result.IsDirectory = fi.IsDir()
	if !result.IsDirectory {
		return result, nil
	}

	// Collect all video files
	var collectVideoFiles func(path string, depth int)
	collectVideoFiles = func(path string, depth int) {
		if depth > 3 {
			return
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			return
		}
		for _, entry := range entries {
			if entry.IsDir() {
				collectVideoFiles(filepath.Join(path, entry.Name()), depth+1)
			} else {
				ext := strings.ToLower(filepath.Ext(entry.Name()))
				if isVideoFile(ext) {
					result.VideoFiles = append(result.VideoFiles, entry.Name())
				}
			}
		}
	}
	collectVideoFiles(dirPath, 0)

	// Sort video files
	sort.Strings(result.VideoFiles)

	if len(result.VideoFiles) > 0 {
		// Find first video file with full path
		firstVideo, _ := findFirstVideoFile(dirPath)
		result.FirstVideoFile = firstVideo
	}

	// Detect if it's a series pack by checking for episode patterns
	episodePattern := regexp.MustCompile(`(?i)[SE]\d{1,2}|Episode|Ep\d`)
	seasonPattern := regexp.MustCompile(`(?i)S(\d{1,2})`)

	detectedSeasons := make(map[string]bool)
	episodeCount := 0

	for _, file := range result.VideoFiles {
		if episodePattern.MatchString(file) {
			episodeCount++
		}
		matches := seasonPattern.FindStringSubmatch(file)
		if len(matches) > 1 {
			detectedSeasons["S"+matches[1]] = true
		}
	}

	// If more than 1 file matches episode pattern, it's likely a series pack
	result.IsSeriesPack = episodeCount > 1 || len(result.VideoFiles) > 3
	result.EpisodeCount = episodeCount

	// Get the most common season
	if len(detectedSeasons) == 1 {
		for season := range detectedSeasons {
			result.DetectedSeason = season
		}
	} else if len(detectedSeasons) > 1 {
		result.DetectedSeason = "COMPLETE"
	}

	return result, nil
}

// GetMediaInfo executes mediainfo command on the file and returns JSON output
func (a *App) GetMediaInfo(filePath string) (*MediaInfoResponse, error) {
	// Check if path is a directory
	fi, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat path: %w", err)
	}

	targetFile := filePath
	if fi.IsDir() {
		// Find the first video file in the directory
		firstVideo, err := findFirstVideoFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("no video file found in directory: %w", err)
		}
		targetFile = firstVideo
		logInfo("GetMediaInfo: directory detected, using first video file: %s", shortPath(targetFile))
	}

	// Check if mediainfo is in PATH
	path, err := exec.LookPath("mediainfo")
	if err != nil {
		return nil, fmt.Errorf("mediainfo not found in PATH: %w", err)
	}

	cmd := exec.Command(path, "--Output=JSON", targetFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("mediainfo execution failed: %w", err)
	}

	var result MediaInfoResponse
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse mediainfo JSON: %w", err)
	}

	return &result, nil
}

// GetMediaInfoText executes mediainfo command and returns text output for NFO
func (a *App) GetMediaInfoText(filePath string) (string, error) {
	// Check if path is a directory
	fi, err := os.Stat(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to stat path: %w", err)
	}

	targetFile := filePath
	if fi.IsDir() {
		// Find the first video file in the directory
		firstVideo, err := findFirstVideoFile(filePath)
		if err != nil {
			return "", fmt.Errorf("no video file found in directory: %w", err)
		}
		targetFile = firstVideo
		logInfo("GetMediaInfoText: directory detected, using first video file: %s", shortPath(targetFile))
	}

	// Check if mediainfo is in PATH
	path, err := exec.LookPath("mediainfo")
	if err != nil {
		return "", fmt.Errorf("mediainfo not found in PATH: %w", err)
	}

	cmd := exec.Command(path, targetFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("mediainfo execution failed: %w", err)
	}

	// Replace full path with just filename in "Complete name" line
	result := string(output)
	fileName := filepath.Base(targetFile)
	lines := strings.Split(result, "\n")
	for i, line := range lines {
		if strings.HasPrefix(line, "Complete name") {
			lines[i] = "Complete name                            : " + fileName
			break
		}
	}
	return strings.Join(lines, "\n"), nil
}

// CreateTorrent creates a .torrent file for the given source path
// torrentName is the name that will appear in the torrent (the release name)
func (a *App) CreateTorrent(sourcePath string, trackers []string, comment string, isPrivate bool, torrentName string) (string, error) {
	info := metainfo.Info{
		PieceLength: 256 * 1024,
	}

	if isPrivate {
		info.Private = new(bool)
		*info.Private = true
	}

	err := info.BuildFromFilePath(sourcePath)
	if err != nil {
		logError("CreateTorrent: failed to build torrent info for %s: %v", shortPath(sourcePath), err)
		return "", err
	}

	// Utiliser le nom personnalisé si fourni, sinon garder le nom du fichier source
	if torrentName != "" {
		// For single-file torrents, add extension to the name
		if len(info.Files) == 0 && info.Length > 0 {
			// Single file torrent - add extension
			sourceFileName := filepath.Base(sourcePath)
			ext := filepath.Ext(sourceFileName)
			info.Name = torrentName + ext
			logInfo("CreateTorrent: single-file torrent, using name with extension: %s", info.Name)
		} else {
			// Multi-file torrent
			info.Name = torrentName
		}
		// Rename video files inside the torrent to match the torrent name (for consistency with hardlinks)
		renameVideoFilesInTorrent(&info, torrentName)
	}

	mi := metainfo.MetaInfo{
		AnnounceList: func() [][]string {
			var list [][]string
			for _, url := range trackers {
				if strings.TrimSpace(url) != "" {
					list = append(list, []string{url})
				}
			}
			return list
		}(),
		Comment:   comment,
		CreatedBy: "AATM-API",
	}
	mi.SetDefaults()

	infoBytes, err := bencode.Marshal(info)
	if err != nil {
		return "", err
	}
	mi.InfoBytes = infoBytes

	// Determine output path
	// If source is in /host (read-only), save torrent to /torrents instead
	// Use the torrent name for the output file if provided
	var baseName string
	if torrentName != "" {
		baseName = torrentName
	} else {
		baseName = filepath.Base(sourcePath)
	}
	var outputPath string
	if strings.HasPrefix(sourcePath, "/host") {
		outputPath = filepath.Join("/torrents", baseName+".torrent")
	} else {
		outputPath = filepath.Join(filepath.Dir(sourcePath), baseName+".torrent")
	}

	outFile, err := os.Create(outputPath)
	if err != nil {
		logError("CreateTorrent: failed to create file %s: %v", shortPath(outputPath), err)
		return "", err
	}
	defer outFile.Close()

	err = mi.Write(outFile)
	if err != nil {
		logError("CreateTorrent: failed to write torrent file: %v", err)
		return "", err
	}

	logInfo("CreateTorrent: created %s (name: %s)", shortPath(outputPath), torrentName)
	return outputPath, nil
}

// SaveNfo saves the NFO content to a file
// If torrentName is provided, it will be used as the filename
func (a *App) SaveNfo(sourcePath string, content string, torrentName string) (string, error) {
	// Determine base name: use torrentName if provided, otherwise derive from source
	var baseName string
	if torrentName != "" {
		baseName = torrentName
	} else {
		baseName = filepath.Base(sourcePath)
		ext := filepath.Ext(sourcePath)
		lowerExt := strings.ToLower(ext)

		// Strip extension if it's a known media file
		if isMediaFile(lowerExt) {
			baseName = strings.TrimSuffix(baseName, ext)
		}
	}

	// Determine output directory
	// If source is in /host (read-only), save to /torrents instead
	var outputDir string
	if strings.HasPrefix(sourcePath, "/host") {
		outputDir = "/torrents"
	} else {
		outputDir = filepath.Dir(sourcePath)
	}

	outputPath := filepath.Join(outputDir, baseName+".nfo")

	err := os.WriteFile(outputPath, []byte(content), 0644)
	if err != nil {
		logError("SaveNfo: failed to write %s: %v", shortPath(outputPath), err)
		return "", err
	}
	logInfo("SaveNfo: created %s", shortPath(outputPath))
	return outputPath, nil
}

// DeleteFile deletes the specified file
func (a *App) DeleteFile(path string) error {
	if path == "" {
		return nil
	}
	return os.Remove(path)
}

// GetDirectorySize calculates the total size of a directory recursively
func (a *App) GetDirectorySize(path string) (string, error) {
	var size int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return formatSize(size), nil
}

func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// FindMatchingHardlinkDir finds a hardlink directory on the same device as sourcePath
func (a *App) FindMatchingHardlinkDir(sourcePath string, hardlinkDirs []string) (string, error) {
	sourceDevID, err := getDeviceID(sourcePath)
	if err != nil {
		return "", fmt.Errorf("cannot get device ID for source: %w", err)
	}

	for _, dir := range hardlinkDirs {
		if dir == "" {
			continue
		}
		// Ensure the directory exists
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			continue
		}
		dirDevID, err := getDeviceID(dir)
		if err != nil {
			continue
		}
		if dirDevID == sourceDevID {
			return dir, nil
		}
	}

	return "", fmt.Errorf("no hardlink directory found on the same device as %s", sourcePath)
}

// CreateHardlink creates hardlinks for the source path in the destination directory
// torrentName is the release name from the torrent metadata (optional)
func (a *App) CreateHardlink(sourcePath string, destDir string, torrentName string) (string, error) {
	sourceInfo, err := os.Stat(sourcePath)
	if err != nil {
		logError("CreateHardlink: cannot stat source %s: %v", shortPath(sourcePath), err)
		return "", fmt.Errorf("cannot stat source: %w", err)
	}

	var baseName string
	if torrentName != "" {
		baseName = torrentName
		if !sourceInfo.IsDir() {
			ext := filepath.Ext(sourcePath)
			if ext != "" && !strings.HasSuffix(strings.ToLower(baseName), strings.ToLower(ext)) {
				baseName += ext
			}
		}
	} else {
		baseName = filepath.Base(sourcePath)
	}
	destPath := filepath.Join(destDir, baseName)

	// Check if destination already exists
	if _, err := os.Stat(destPath); err == nil {
		// File/directory already exists - remove it first
		logInfo("CreateHardlink: destination already exists, removing: %s", shortPath(destPath))
		if err := os.RemoveAll(destPath); err != nil {
			logError("CreateHardlink: failed to remove existing destination: %v", err)
			return "", fmt.Errorf("failed to remove existing destination: %w", err)
		}
	}

	if sourceInfo.IsDir() {
		// For directories, create directory structure and hardlink all files
		err = a.hardlinkDirectory(sourcePath, destPath)
		if err != nil {
			logError("CreateHardlink: failed to hardlink directory: %v", err)
			return "", err
		}
		// Rename the video file inside the directory to match the directory name
		if err := a.renameVideoInDir(destPath, baseName); err != nil {
			logWarn("CreateHardlink: could not rename video in %s: %v", shortPath(destPath), err)
		}
	} else {
		// For single files, just create the hardlink
		err = os.Link(sourcePath, destPath)
		if err != nil {
			logError("CreateHardlink: failed to create hardlink: %v", err)
			return "", fmt.Errorf("failed to create hardlink: %w", err)
		}
	}

	logInfo("CreateHardlink: created %s (name: %s)", shortPath(destPath), torrentName)
	return destPath, nil
}

// hardlinkDirectory recursively creates hardlinks for all files in a directory
func (a *App) hardlinkDirectory(srcDir, destDir string) error {
	log.Printf("[DEBUG] hardlinkDirectory: %s -> %s", shortPath(srcDir), shortPath(destDir))
	// Create destination directory
	if err := os.MkdirAll(destDir, 0755); err != nil {
		logError("hardlinkDirectory: failed to create directory %s: %v", shortPath(destDir), err)
		return fmt.Errorf("failed to create directory %s: %w", destDir, err)
	}

	entries, err := os.ReadDir(srcDir)
	if err != nil {
		logError("hardlinkDirectory: failed to read directory %s: %v", shortPath(srcDir), err)
		return fmt.Errorf("failed to read directory %s: %w", srcDir, err)
	}

	for _, entry := range entries {
		srcPath := filepath.Join(srcDir, entry.Name())
		destPath := filepath.Join(destDir, entry.Name())

		if entry.IsDir() {
			// Recursively handle subdirectories
			if err := a.hardlinkDirectory(srcPath, destPath); err != nil {
				return err
			}
		} else {
			// Create hardlink for files
			if err := os.Link(srcPath, destPath); err != nil {
				logError("hardlinkDirectory: failed to hardlink %s: %v", entry.Name(), err)
				return fmt.Errorf("failed to create hardlink %s -> %s: %w", srcPath, destPath, err)
			}
		}
	}

	return nil
}

// renameVideoInDir renames the single video file in the directory to match the directory name
func (a *App) renameVideoInDir(dirPath, newName string) error {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		logError("renameVideoInDir: failed to read directory %s: %v", shortPath(dirPath), err)
		return err
	}

	var videoFiles []os.DirEntry
	for _, entry := range entries {
		if !entry.IsDir() && isVideoFile(strings.ToLower(filepath.Ext(entry.Name()))) {
			videoFiles = append(videoFiles, entry)
		}
	}

	// Only rename if there is exactly one video file to avoid ambiguity
	if len(videoFiles) == 1 {
		oldName := videoFiles[0].Name()
		ext := filepath.Ext(oldName)
		newFileName := newName + ext
		if oldName != newFileName {
			oldPath := filepath.Join(dirPath, oldName)
			newPath := filepath.Join(dirPath, newFileName)
			err := os.Rename(oldPath, newPath)
			if err != nil {
				logError("renameVideoInDir: failed to rename %s -> %s: %v", oldName, newFileName, err)
				return err
			}
		}
	} else if len(videoFiles) > 1 {
		logWarn("renameVideoInDir: skipped rename (found %d videos, ambiguous)", len(videoFiles))
	}
	return nil
}

// GetLaCaleTagsPreview returns the La Cale tag names (for display) that would be selected for a given media
func (a *App) GetLaCaleTagsPreview(mediaType string, releaseInfo ReleaseInfo) ([]string, error) {
	// Load embedded tags data
	var meta LocalMetaRoot
	if err := json.Unmarshal([]byte(tagsData), &meta); err != nil {
		return nil, fmt.Errorf("failed to parse embedded tags data: %w", err)
	}

	// Find category and characteristics
	_, relevantChars := findLocalCategory(meta.Categories, mediaType)
	if len(relevantChars) == 0 {
		return []string{}, nil
	}

	// Find matching tags - use tag names for display instead of IDs
	matchedTags := findLocalMatchingTagNames(relevantChars, releaseInfo)
	return matchedTags, nil
}

// TagCategory represents a category of tags for the frontend
type TagCategory struct {
	Name string    `json:"name"`
	Slug string    `json:"slug"`
	Tags []TagInfo `json:"tags"`
}

// TagInfo represents a single tag with its ID and name
type TagInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GetLaCaleAllTags returns all available tags organized by category, plus the auto-selected tags
func (a *App) GetLaCaleAllTags(mediaType string, releaseInfo ReleaseInfo) ([]TagCategory, []string, error) {
	// Load embedded tags data
	var meta LocalMetaRoot
	if err := json.Unmarshal([]byte(tagsData), &meta); err != nil {
		return nil, nil, fmt.Errorf("failed to parse embedded tags data: %w", err)
	}

	// Find category and characteristics for this media type
	_, relevantChars := findLocalCategory(meta.Categories, mediaType)
	if len(relevantChars) == 0 {
		return []TagCategory{}, []string{}, nil
	}

	// Build the list of all tags by category
	var categories []TagCategory
	for _, char := range relevantChars {
		var tags []TagInfo
		for _, t := range char.Tags {
			if t.ID != "" { // Only include tags with valid IDs
				tags = append(tags, TagInfo{
					ID:   t.ID,
					Name: t.Name,
				})
			}
		}
		if len(tags) > 0 {
			categories = append(categories, TagCategory{
				Name: char.Name,
				Slug: char.Slug,
				Tags: tags,
			})
		}
	}

	// Get the auto-selected tag IDs
	selectedTagIDs := findLocalMatchingTags(relevantChars, releaseInfo)

	return categories, selectedTagIDs, nil
}
