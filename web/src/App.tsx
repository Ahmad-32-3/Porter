import { CrowdFunnel } from './components/CrowdFunnel'
import { CrowdGauge } from './components/CrowdGauge'
import { CrowdLiveLines } from './components/CrowdLiveLines'
import ParticleButton from './components/kokonutui/particle-button'
import AppleActivityCard from './components/kokonutui/apple-activity-card'
import { CacheLeakViz } from './components/story/CacheLeakViz'
import { CollapseViz } from './components/story/CollapseViz'
import { OverflowViz } from './components/story/OverflowViz'
import { PathLineViz } from './components/story/PathLineViz'
import { BottleneckViz } from './components/story/BottleneckViz'
import { StampedeViz } from './components/story/StampedeViz'
import { StoryBeat } from './components/story/StoryBeat'
import { useCrowdPlayback } from './hooks/useCrowdPlayback'

export function App() {
  const crowd = useCrowdPlayback()

  const tick = crowd.tick
  const ringTarget = crowd.result
    ? Math.max(
        crowd.result.served,
        crowd.result.waitingPeak,
        crowd.result.originGrades + crowd.result.originTax + crowd.result.originStatic,
        1,
      )
    : 1
  const originTrips = crowd.result
    ? crowd.result.originGrades + crowd.result.originTax + crowd.result.originStatic
    : 0
  const waitingRing = crowd.paused && crowd.result ? crowd.result.waitingPeak : (tick?.waiting ?? 0)
  const servedRing = tick?.served ?? 0
  const originRing = tick ? tick.originGet + tick.tax + (crowd.result?.originStatic ?? 0) : originTrips

  return (
    <main className="page">
      <header className="page-hero">
        <p className="meta">Case study</p>
        <h1>Porter</h1>
        <p className="lead">
          When a lot of people open the same web page at once, the site behind it can fall over. This is the story of a
          page of mine that did, and the small program I wrote to keep the rest of the site up when it happens.
        </p>
        <p className="intro-detail">
          Porter is a reverse proxy: you run it in front of your web app. It puts a waiting line on the one crowded page
          and lets every other page through untouched. The Go binary is the product (<code>docker compose up</code>).
          The charts on this page are a browser simulation, not a live call to the proxy.
        </p>
      </header>

      <StoryBeat
        id="the-problem"
        kicker="The problem"
        stage={0}
        stageCaption="Left: the grades window, mobbed. Right: tax forms. Both share the one computer behind the glass, so when grades floods it, tax is stuck too."
        title="Grade day"
        visual={
          <>
            <BottleneckViz />
            <StampedeViz />
          </>
        }
      >
        <p>
          I watched this happen to a page I run. Grades for University of Waterloo undergrads drop at a set time, and the
          minute they did, everyone opened the grades page at once. It went down and stayed down. That is where Porter
          came from.
        </p>
        <p>
          The mechanics are dull. Opening a page makes the server do some work. Ask for something cheap, like a logo, and
          it barely notices. My grades page ran a separate database lookup for each student, and thousands of those in
          the same minute is enough to make it fall behind, then stop answering at all.
        </p>
        <p>
          What made it worse is that the portal is one site. Tax forms (T4 slips), transcripts, and receipts sit on the
          same server as grades. When the grades crowd buried it, those pages went down too, even though almost nobody
          was asking for them.
        </p>
        <p>
          So I could not just put the whole portal behind one line. That would make people queue to print a tax form. The
          fix had to be narrower: a line on the one crowded page, and nothing in the way of the rest.
        </p>
      </StoryBeat>

      <StoryBeat
        id="cache-all"
        kicker="First try"
        stage={1}
        stageCaption="One page is saved and handed to everyone. It is Anna's page, so Ben and Cara get Anna's grades. Wrong person."
        title="Save the page and hand out copies"
        visual={<CacheLeakViz />}
      >
        <p>
          The first thing you try is to stop doing the work. Save one copy of the grades page and give it to everyone who
          asks. No database lookup, no waiting.
        </p>
        <p>
          It breaks right away. Grades are personal. The saved copy is one student&apos;s page, so the next student sees
          someone else&apos;s marks. A saved page is also a snapshot, so it can show last term&apos;s numbers as if they
          were today&apos;s.
        </p>
      </StoryBeat>

      <StoryBeat
        id="collapse"
        kicker="Second try"
        stage={2}
        stageCaption="A shared file, the stylesheet: fetch it once, give it to all. Private grades: each person still needs their own fetch."
        title="Fetch shared things once"
        visual={<CollapseViz />}
      >
        <p>
          A softer version: when many people ask for the exact same thing at the same moment, fetch it once and give them
          all that one answer. This works for a shared file like the page&apos;s stylesheet, which is identical for
          everyone.
        </p>
        <p>
          It does nothing safe for grades. Each student&apos;s grades are different, so there is no single answer to
          share. Fetching once only helps pages that are the same for everybody. (Developers call this move request
          collapsing.)
        </p>
      </StoryBeat>

      <StoryBeat
        id="path-line"
        kicker="Third try"
        stage={3}
        stageCaption="A line at the grades window only. A few go through at a time. Tax forms walk straight past it."
        title="Put the line where the crowd is"
        visual={<PathLineViz />}
      >
        <p>
          So put the line where the crowd actually is. Only the grades page gets a waiting room and a cap on how many run
          at once. Tax forms and transcripts skip it and load normally.
        </p>
        <p>
          This is the shape that works, and it is not new. MacEwan University wrapped only its course-registration page
          in a queue and left the rest of the portal running. Porter is that idea as a small program you run in front of
          your own site.
        </p>
      </StoryBeat>

      <StoryBeat
        id="overflow"
        kicker="What Porter ships"
        stage={4}
        stageCaption="A wait page with your position, plus a small 'try anyway' lane. Tax forms still pass."
        title="A wait page that opens when it is your turn"
        visual={<OverflowViz />}
      >
        <p>
          The waiting room is a plain page. It shows your place in line and opens grades once the server has room. It
          checks a cheap &quot;ready yet?&quot; flag on a timer, so waiting costs the server almost nothing.
        </p>
        <p>
          There is a small &quot;try anyway&quot; lane for people who do not want to wait, with its own tight cap. It
          stays small on purpose. If everyone could skip the line, there would be no line.
        </p>
      </StoryBeat>

      <section className="section crowd-section" id="run-crowd">
        <div className="crowd-section__copy">
          <p className="story-kicker">Try it</p>
          <h2>Run a crowd</h2>
          <p>
            Press the button. The charts run Porter&apos;s rules in your browser: a capped number of grades lookups at
            once, tax forms passing freely, and the small overflow lane. Amber counts grades lookups reaching the server.
            Teal counts tax forms. The lines freeze when the run ends.
          </p>
          <ParticleButton onSuccess={crowd.run} type="button">
            Run crowd
          </ParticleButton>
          <div className="legend">
            <span>
              <i className="swatch grades" />
              grades
            </span>
            <span>
              <i className="swatch tax" />
                tax forms
              </span>
          </div>
          {crowd.result ? (
            <p className="meta">
              grades lookups {crowd.result.originGrades}, tax fetches {crowd.result.originTax}, shared files{' '}
              {crowd.result.originStatic}, tried the overflow lane {crowd.result.overflowUsed}, longest line{' '}
              {crowd.result.waitingPeak}
            </p>
          ) : null}
        </div>
        <div className="crowd-section__charts">
          <div className="chart-wrap">
            <CrowdLiveLines
              grades={crowd.live.grades}
              paused={crowd.paused}
              reducedMotion={crowd.reduced}
              split
              tax={crowd.live.tax}
            />
          </div>
          <div className="crowd-section__pair">
            <CrowdGauge result={crowd.result} tick={crowd.gaugeTick} />
            <CrowdFunnel tick={crowd.funnelTick} />
          </div>
          {crowd.result && tick ? (
            <AppleActivityCard
              reducedMotion={crowd.reduced || crowd.paused}
              rings={[
                {
                  label: 'served',
                  current: servedRing,
                  target: ringTarget,
                  color: '#22a58f',
                  endColor: '#5fe0ce',
                },
                {
                  label: 'waiting',
                  current: waitingRing,
                  target: ringTarget,
                  color: '#e2703a',
                  endColor: '#f0a070',
                },
                {
                  label: 'origin',
                  current: crowd.paused ? originTrips : originRing,
                  target: ringTarget,
                  color: '#35c9b4',
                  endColor: '#5fe0ce',
                },
              ]}
              title="Run totals"
            />
          ) : null}
        </div>
      </section>

      <section className="section section--recap" id="recap">
        <h2>The rules, in one place</h2>
        <p>
          Porter sits in front of your app and reads the path of each request. Four behaviors cover the whole grade-day
          problem:
        </p>
        <dl className="recap">
          <div className="recap__row">
            <dt>The crowded page (grades)</dt>
            <dd>A waiting room and a cap on how many run at once. You get a place in line.</dd>
          </div>
          <div className="recap__row">
            <dt>Everything else (tax forms, transcripts)</dt>
            <dd>Straight through. No line, no ticket.</dd>
          </div>
          <div className="recap__row">
            <dt>Shared files (stylesheets, status flags)</dt>
            <dd>Fetched once and handed to everyone waiting, since the answer is the same for all.</dd>
          </div>
          <div className="recap__row">
            <dt>The wait page</dt>
            <dd>Plain HTML with your position and a small side lane. It opens grades once the server has room.</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <h2>Making it survive the rush</h2>
        <p>
          The path rules are the idea. But a proxy named after a stampede has to survive one, so a few smaller decisions
          end up mattering more than they look:
        </p>
        <dl className="recap">
          <div className="recap__row">
            <dt>Slots that free themselves</dt>
            <dd>
              The waiting line lives in Redis with a short lease. If Porter is restarted mid-request, the slot it was
              holding expires on its own instead of shrinking the line&apos;s cap forever.
            </dd>
          </div>
          <div className="recap__row">
            <dt>Shared files expire on time</dt>
            <dd>
              A collapsed file is kept only as long as the origin&apos;s own <code>max-age</code> says it is good, so a
              stylesheet change is never stuck behind a stale copy.
            </dd>
          </div>
          <div className="recap__row">
            <dt>No slow-client stalls</dt>
            <dd>Both servers cap how long they wait for a request to arrive, so one slow connection cannot tie up a worker.</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <h2>Run it yourself</h2>
        <p>From the repo root, one command brings up Porter, a fake campus origin, and Redis:</p>
        <p>
          <code>docker compose -f deploy/compose.yaml up --build</code>
        </p>
        <p>
          Porter listens on <code>:8080</code>. To put it in front of your own site, set the origin and path rules in{' '}
          <code>porter.yaml</code>. The README has the full setup.
        </p>
      </section>

      <footer className="page-footer">
        <p className="meta">
          Porter is a case study of a small Go reverse proxy. The binary is the product; this page is the write-up. The
          source and setup live in the repo README.
        </p>
      </footer>
    </main>
  )
}
