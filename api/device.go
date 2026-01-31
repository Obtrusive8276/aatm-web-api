//go:build linux
// +build linux

package main

import "syscall"

// getDeviceID returns the device ID of the filesystem containing the path
func getDeviceID(path string) (uint64, error) {
	var stat syscall.Stat_t
	err := syscall.Stat(path, &stat)
	if err != nil {
		return 0, err
	}
	return uint64(stat.Dev), nil
}
