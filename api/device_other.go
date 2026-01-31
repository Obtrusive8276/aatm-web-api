//go:build !linux
// +build !linux

package main

import "errors"

// getDeviceID returns the device ID of the filesystem containing the path
// On non-Linux systems, this is not supported
func getDeviceID(path string) (uint64, error) {
	return 0, errors.New("getDeviceID not supported on this platform")
}
