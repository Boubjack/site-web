// =============================================================================
//  Infinity Football — Game / Football / Match / MatchEngine (implementation)
// =============================================================================
#include "Game/Football/Match/MatchEngine.hpp"

#include "Engine/Logging/Logger.hpp"

namespace inf::football
{
    const char* ToString(MatchPhase p) noexcept
    {
        switch (p)
        {
            case MatchPhase::PreMatch:   return "PreMatch";
            case MatchPhase::FirstHalf:  return "FirstHalf";
            case MatchPhase::HalfTime:   return "HalfTime";
            case MatchPhase::SecondHalf: return "SecondHalf";
            case MatchPhase::FullTime:   return "FullTime";
        }
        return "Unknown";
    }

    MatchEngine::MatchEngine(Pitch pitch, Team home, Team away, MatchConfig config)
        : pitch_(std::move(pitch)),
          home_(std::move(home)),
          away_(std::move(away)),
          ball_(world_, {0.0f, 0.11f, 0.0f}),
          cameraDirector_(camera_),
          config_(config)
    {
    }

    void MatchEngine::RegisterPlayerBodies()
    {
        bodyToSide_.clear();
        for (Team* team : {&home_, &away_})
        {
            for (auto& player : team->Starters())
            {
                physics::RigidBody body;
                const math::Vec3 p = player.Position();
                body.position = {p.x, player.BodyRadius(), p.z};
                body.radius = player.BodyRadius();
                body.mass = 75.0f;
                body.restitution = 0.3f;
                body.friction = 0.6f;
                body.dynamic = false; // no movement AI yet: players are colliders
                const physics::BodyId id = world_.AddBody(body);
                player.SetBodyId(id);
                bodyToSide_[id] = team->TeamSide();
            }
        }
    }

    void MatchEngine::PlaceBallAtRest(const math::Vec3& where)
    {
        ball_.ResetTo({where.x, ball_.Radius(), where.z});
    }

    void MatchEngine::Start()
    {
        world_.SetGravity({0.0f, -9.81f, 0.0f});
        world_.ClearColliders();
        pitch_.BuildColliders(world_);

        home_.ApplyFormation(pitch_);
        away_.ApplyFormation(pitch_);
        RegisterPlayerBodies();

        clock_.Reset();
        clock_.StartHalf();
        score_.Reset();
        stats_.Reset();
        officials_.referee.Discipline().Reset();

        kickoffSide_ = Side::Home;
        lastTouch_ = Side::Home;
        PlaceBallAtRest(pitch_.Centre());

        phase_ = MatchPhase::FirstHalf;
        cameraDirector_.Update(ball_.Position(), pitch_);
        INF_LOG_INFO("Match kickoff: " << home_.Name() << " vs " << away_.Name());
    }

    void MatchEngine::Update(f64 dt)
    {
        switch (phase_)
        {
            case MatchPhase::PreMatch:
                return; // Start() must be called first
            case MatchPhase::FirstHalf:
                Simulate(dt);
                if (clock_.HalfElapsed() >= config_.halfLengthSeconds + config_.stoppageFirstSeconds)
                {
                    phase_ = MatchPhase::HalfTime;
                    INF_LOG_INFO("Half-time: " << score_.home << "-" << score_.away);
                }
                return;
            case MatchPhase::HalfTime:
                BeginSecondHalf();
                return;
            case MatchPhase::SecondHalf:
                Simulate(dt);
                if (clock_.HalfElapsed() >= config_.halfLengthSeconds + config_.stoppageSecondSeconds)
                {
                    phase_ = MatchPhase::FullTime;
                    events_.Emit(MatchEnded{score_.home, score_.away});
                    INF_LOG_INFO("Full-time: " << score_.home << "-" << score_.away);
                }
                return;
            case MatchPhase::FullTime:
                return;
        }
    }

    void MatchEngine::BeginSecondHalf()
    {
        phase_ = MatchPhase::SecondHalf;
        clock_.StartHalf();
        kickoffSide_ = Side::Away;
        lastTouch_ = Side::Away;
        PlaceBallAtRest(pitch_.Centre());
        cameraDirector_.Update(ball_.Position(), pitch_);
    }

    void MatchEngine::Simulate(f64 dt)
    {
        const auto& collisions = world_.Step(dt);
        clock_.Advance(dt);
        UpdateLastTouch(collisions);

        if (!CheckGoal())
        {
            CheckOutOfPlay();
        }
        UpdatePossession(dt);
        cameraDirector_.Update(ball_.Position(), pitch_);
    }

    void MatchEngine::UpdateLastTouch(const std::vector<physics::CollisionEvent>& collisions)
    {
        const physics::BodyId ballId = ball_.BodyId();
        for (const auto& e : collisions)
        {
            if (e.kind != physics::CollisionKind::BodyBody) { continue; }
            physics::BodyId other = 0;
            if (e.a == ballId) { other = e.b; }
            else if (e.b == ballId) { other = e.a; }
            else { continue; }

            const auto it = bodyToSide_.find(other);
            if (it != bodyToSide_.end()) { lastTouch_ = it->second; }
        }
    }

    bool MatchEngine::CheckGoal()
    {
        const math::Vec3 pos = ball_.Position();
        const f32 r = ball_.Radius();
        for (Side goalSide : {Side::Home, Side::Away})
        {
            if (!pitch_.IsGoal(goalSide, pos, r)) { continue; }

            const Side scorer = Opponent(goalSide);
            score_.Add(scorer);
            ++stats_.Of(scorer).goals;
            ++stats_.Of(scorer).shotsOnTarget;

            events_.Emit(GoalScored{scorer, clock_.Minute()});
            INF_LOG_INFO("GOAL for " << ToString(scorer) << " (" << score_.home << "-"
                                     << score_.away << ", " << clock_.Minute() << "')");

            // Conceding team kicks off.
            kickoffSide_ = goalSide;
            lastTouch_ = goalSide;
            PlaceBallAtRest(pitch_.Centre());
            return true;
        }
        return false;
    }

    void MatchEngine::CheckOutOfPlay()
    {
        const math::Vec3 pos = ball_.Position();
        if (pitch_.IsInsideField(pos)) { return; }

        const RestartDecision d =
            RuleBook::EvaluateOutOfPlay(pitch_, pos, ball_.Radius(), lastTouch_);
        if (d.type == RestartType::None) { return; }

        switch (d.type)
        {
            case RestartType::ThrowIn:  ++stats_.Of(d.forSide).throwIns; break;
            case RestartType::CornerKick: ++stats_.Of(d.forSide).corners; break;
            case RestartType::GoalKick: ++stats_.Of(d.forSide).goalKicks; break;
            default: break;
        }
        events_.Emit(RestartAwarded{d.type, d.forSide});
        lastTouch_ = d.forSide;
        PlaceBallAtRest(d.position);
    }

    Side MatchEngine::NearestSideToBall() const
    {
        const math::Vec3 b = ball_.Position();
        f32 best = 1e30f;
        Side side = lastTouch_;
        for (const Team* team : {&home_, &away_})
        {
            for (const auto& player : team->Starters())
            {
                const math::Vec3 p = player.Position();
                const f32 dx = p.x - b.x;
                const f32 dz = p.z - b.z;
                const f32 d2 = dx * dx + dz * dz;
                if (d2 < best)
                {
                    best = d2;
                    side = team->TeamSide();
                }
            }
        }
        return side;
    }

    void MatchEngine::UpdatePossession(f64 dt)
    {
        stats_.AddPossession(NearestSideToBall(), dt);
    }

    void MatchEngine::ApplyKick(Side by, const math::Vec3& impulse)
    {
        lastTouch_ = by;
        ++stats_.Of(by).shots;
        ball_.Kick(impulse);
    }

    void MatchEngine::SaveState(save::SaveData& out) const
    {
        out.SetString("match.home_team", home_.Name());
        out.SetString("match.away_team", away_.Name());
        out.SetInt("match.score_home", static_cast<i64>(score_.home));
        out.SetInt("match.score_away", static_cast<i64>(score_.away));
        out.SetFloat("match.time_total", clock_.Total());
        out.SetInt("match.phase", static_cast<i64>(phase_));

        for (Side s : {Side::Home, Side::Away})
        {
            const TeamStats& t = stats_.Of(s);
            const String p = s == Side::Home ? "home" : "away";
            out.SetInt("stats." + p + ".shots", static_cast<i64>(t.shots));
            out.SetInt("stats." + p + ".shots_on_target", static_cast<i64>(t.shotsOnTarget));
            out.SetInt("stats." + p + ".corners", static_cast<i64>(t.corners));
            out.SetInt("stats." + p + ".throw_ins", static_cast<i64>(t.throwIns));
            out.SetInt("stats." + p + ".goal_kicks", static_cast<i64>(t.goalKicks));
            out.SetInt("stats." + p + ".fouls", static_cast<i64>(t.fouls));
            out.SetInt("stats." + p + ".yellow_cards", static_cast<i64>(t.yellowCards));
            out.SetInt("stats." + p + ".red_cards", static_cast<i64>(t.redCards));
            out.SetFloat("stats." + p + ".possession", stats_.PossessionPercent(s));
        }
    }

    void MatchEngine::LoadState(const save::SaveData& in)
    {
        score_.home = static_cast<u32>(in.GetInt("match.score_home", 0));
        score_.away = static_cast<u32>(in.GetInt("match.score_away", 0));
        clock_.Restore(in.GetFloat("match.time_total", 0.0));
        phase_ = static_cast<MatchPhase>(in.GetInt("match.phase", 0));

        for (Side s : {Side::Home, Side::Away})
        {
            TeamStats& t = stats_.Of(s);
            const String p = s == Side::Home ? "home" : "away";
            t.shots = static_cast<u32>(in.GetInt("stats." + p + ".shots", 0));
            t.shotsOnTarget = static_cast<u32>(in.GetInt("stats." + p + ".shots_on_target", 0));
            t.corners = static_cast<u32>(in.GetInt("stats." + p + ".corners", 0));
            t.throwIns = static_cast<u32>(in.GetInt("stats." + p + ".throw_ins", 0));
            t.goalKicks = static_cast<u32>(in.GetInt("stats." + p + ".goal_kicks", 0));
            t.fouls = static_cast<u32>(in.GetInt("stats." + p + ".fouls", 0));
            t.yellowCards = static_cast<u32>(in.GetInt("stats." + p + ".yellow_cards", 0));
            t.redCards = static_cast<u32>(in.GetInt("stats." + p + ".red_cards", 0));
        }
    }
} // namespace inf::football
