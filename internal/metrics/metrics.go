package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type M struct {
	Admitted  prometheus.Counter
	Queued    prometheus.Counter
	Grades    prometheus.Counter
	Tax       prometheus.Counter
	Collapsed prometheus.Counter
	Overflow  prometheus.Counter
	reg       *prometheus.Registry
}

func New() *M {
	reg := prometheus.NewRegistry()
	m := &M{
		Admitted: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_admitted",
			Help: "Wait-mode requests admitted to origin on the main lane",
		}),
		Queued: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_queued",
			Help: "Wait-mode requests that received the waiting room",
		}),
		Grades: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_origin_grades",
			Help: "Origin fetches for the grades path",
		}),
		Tax: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_origin_tax",
			Help: "Origin fetches for the tax path",
		}),
		Collapsed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_collapsed",
			Help: "Responses served from a collapsed public fill",
		}),
		Overflow: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "porter_overflow",
			Help: "Wait-mode requests admitted on the overflow lane",
		}),
		reg: reg,
	}
	reg.MustRegister(m.Admitted, m.Queued, m.Grades, m.Tax, m.Collapsed, m.Overflow)
	return m
}

func (m *M) Handler() http.Handler {
	return promhttp.HandlerFor(m.reg, promhttp.HandlerOpts{})
}
