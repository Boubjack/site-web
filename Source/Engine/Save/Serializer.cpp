// =============================================================================
//  Infinity Football — Engine / Save / Serializer (implementation)
// =============================================================================
#include "Engine/Save/Serializer.hpp"

#include <sstream>

namespace inf::save
{
    namespace
    {
        constexpr const char* kMagic = "INFSAVE";

        // Escape backslash and newline so values round-trip through a line format.
        String Escape(const String& in)
        {
            String out;
            out.reserve(in.size());
            for (char c : in)
            {
                switch (c)
                {
                    case '\\': out += "\\\\"; break;
                    case '\n': out += "\\n"; break;
                    case '\r': out += "\\r"; break;
                    default:   out += c; break;
                }
            }
            return out;
        }

        String Unescape(const String& in)
        {
            String out;
            out.reserve(in.size());
            for (usize i = 0; i < in.size(); ++i)
            {
                if (in[i] == '\\' && i + 1 < in.size())
                {
                    const char n = in[++i];
                    switch (n)
                    {
                        case 'n':  out += '\n'; break;
                        case 'r':  out += '\r'; break;
                        case '\\': out += '\\'; break;
                        default:   out += n; break;
                    }
                }
                else
                {
                    out += in[i];
                }
            }
            return out;
        }
    } // namespace

    String Serializer::Serialize(const SaveData& data)
    {
        std::ostringstream out;
        out << kMagic << " v" << data.Version() << '\n';
        for (const auto& [key, value] : data.Values())
        {
            out << Escape(key) << '=' << Escape(value) << '\n';
        }
        return out.str();
    }

    Result<SaveData> Serializer::Deserialize(const String& text)
    {
        std::istringstream in(text);
        String header;
        if (!std::getline(in, header) || header.rfind(kMagic, 0) != 0)
        {
            return Result<SaveData>::Err("invalid save header");
        }

        SaveData data;
        // Parse "INFSAVE v<n>".
        const auto vpos = header.find('v');
        if (vpos != String::npos)
        {
            data.SetVersion(static_cast<u32>(std::stoul(header.substr(vpos + 1))));
        }

        String line;
        while (std::getline(in, line))
        {
            if (line.empty()) { continue; }
            const auto eq = line.find('=');
            if (eq == String::npos) { continue; }
            data.SetString(Unescape(line.substr(0, eq)), Unescape(line.substr(eq + 1)));
        }
        return Result<SaveData>::Ok(std::move(data));
    }
} // namespace inf::save
