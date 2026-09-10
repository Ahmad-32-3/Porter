package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Mode string

const (
	ModeWait     Mode = "wait"
	ModePass     Mode = "pass"
	ModeCollapse Mode = "collapse"
)

type Config struct {
	Origin string  `yaml:"origin"`
	Listen string  `yaml:"listen"`
	Redis  string  `yaml:"redis"`
	Routes []Route `yaml:"routes"`
	Fail   Fail    `yaml:"fail"`
	Cookie Cookie  `yaml:"cookie"`
	Poll   Poll    `yaml:"poll"`
}

type Route struct {
	Prefix         string `yaml:"prefix"`
	Mode           Mode   `yaml:"mode"`
	MaxActive      int    `yaml:"max_active"`
	OverflowActive int    `yaml:"overflow_active"`
}

type Fail struct {
	RedisDownPass string `yaml:"redis_down_pass"`
	RedisDownWait string `yaml:"redis_down_wait"`
}

type Cookie struct {
	Name     string `yaml:"name"`
	HTTPOnly *bool  `yaml:"http_only"`
	SameSite string `yaml:"same_site"`
}

func (c Cookie) HTTPOnlyEnabled() bool {
	if c.HTTPOnly == nil {
		return true
	}
	return *c.HTTPOnly
}

type Poll struct {
	MinMS    int `yaml:"min_ms"`
	JitterMS int `yaml:"jitter_ms"`
}

func Load(path string) (Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config %s: %w", path, err)
	}
	return Parse(raw)
}

func Parse(raw []byte) (Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(raw, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	cfg.applyDefaults()
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c *Config) applyDefaults() {
	if c.Listen == "" {
		c.Listen = ":8080"
	}
	if c.Cookie.Name == "" {
		c.Cookie.Name = "porter_ticket"
	}
	if c.Cookie.SameSite == "" {
		c.Cookie.SameSite = "Lax"
	}
	if c.Fail.RedisDownPass == "" {
		c.Fail.RedisDownPass = "open"
	}
	if c.Fail.RedisDownWait == "" {
		c.Fail.RedisDownWait = "closed"
	}
	if c.Poll.MinMS == 0 {
		c.Poll.MinMS = 1500
	}
	if c.Poll.JitterMS == 0 {
		c.Poll.JitterMS = 800
	}
}

func (c Config) validate() error {
	if c.Origin == "" {
		return fmt.Errorf("origin is required")
	}
	for i, r := range c.Routes {
		if r.Prefix == "" {
			return fmt.Errorf("routes[%d]: prefix is required", i)
		}
		switch r.Mode {
		case ModeWait, ModePass, ModeCollapse:
		default:
			return fmt.Errorf("routes[%d]: unknown mode %q", i, r.Mode)
		}
		if r.Mode == ModeWait && r.MaxActive <= 0 {
			return fmt.Errorf("routes[%d] (%s): wait mode needs max_active > 0, else nobody is ever admitted", i, r.Prefix)
		}
		if r.OverflowActive < 0 {
			return fmt.Errorf("routes[%d] (%s): overflow_active cannot be negative", i, r.Prefix)
		}
	}
	return nil
}

func (c Config) MemoryQueue() bool {
	return strings.TrimSpace(c.Redis) == ""
}

// Match returns the longest slash-boundary prefix route.
// "/grades" matches "/grades", "/grades/", "/grades/123".
// It does not match "/grades-backup".
func (c Config) Match(path string) (Route, bool) {
	best := Route{}
	found := false
	for _, r := range c.Routes {
		if !slashBoundaryPrefix(path, r.Prefix) {
			continue
		}
		if !found || len(r.Prefix) > len(best.Prefix) {
			best = r
			found = true
		}
	}
	return best, found
}

func slashBoundaryPrefix(path, prefix string) bool {
	if prefix == "" {
		return false
	}
	if path == prefix {
		return true
	}
	if !strings.HasPrefix(path, prefix) {
		return false
	}
	if strings.HasSuffix(prefix, "/") {
		return true
	}
	rest := path[len(prefix):]
	return rest == "" || rest[0] == '/'
}
